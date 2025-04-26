import sequelize from '../config/sequelize.js';
import dotenv from 'dotenv';
import WA_UsersMetadata from '../models/WA_UsersMetadata.js';

dotenv.config();

// Default bot IDs from environment variables
const teacherBotPhoneNumberId = process.env.TEACHER_BOT_PHONE_NUMBER_ID;
const studentBotPhoneNumberId = process.env.STUDENT_BOT_PHONE_NUMBER_ID;

// Set this to true when ready to execute Phase 2 (changing primary keys)
const EXECUTE_PHASE_2 = true;

async function migrateUsers() {
    const transaction = await sequelize.transaction();

    try {
        console.log('Starting migration process...');

        // 0. Create the active sessions table
        console.log('Creating wa_active_sessions table...');
        await sequelize.query(`
            CREATE TABLE public.wa_active_sessions (
                phone_number text NOT NULL,
                bot_phone_number_id text NOT NULL,
                profile_id integer,
                last_updated timestamp DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (phone_number, bot_phone_number_id)
            );`, { transaction });

        // 1. Create the new profile table
        console.log('Creating wa_user_profiles table...');
        await sequelize.query(`
            CREATE TABLE public.wa_profiles (
                profile_id serial PRIMARY KEY,
                phone_number text NOT NULL,
                bot_phone_number_id text NOT NULL,
                profile_type text,
                created_at timestamp DEFAULT CURRENT_TIMESTAMP
            );
        `, { transaction });

        // 2. Alter existing tables to add profile_id column (OUTSIDE the loop)
        console.log('Adding profile_id column to existing tables...');

        const tables = [
            'wa_users_metadata',
            'wa_user_progress',
            'wa_user_activity_logs',
            'wa_lessons_completed',
            'wa_question_responses',
            'wa_purchased_courses',
            'wa_feedback'
        ];

        await sequelize.query(`
            ALTER TABLE "wa_user_activity_logs" ADD COLUMN "bot_phone_number_id" text;
        `, { transaction });

        for (const table of tables) {
            console.log(`Adding profile_id to ${table}...`);
            await sequelize.query(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS profile_id INTEGER;
      `, { transaction });
        }

        // 3. Get all existing users from the metadata table
        console.log('Fetching existing users...');
        const users = await WA_UsersMetadata.findAll({
            attributes: ['phoneNumber'],
            transaction
        });

        console.log(`Found ${users.length} users to migrate`);

        // 4. Insert profiles for each user and update references
        let counter = 0;
        const batchSize = 100; // Process 100 users at a time

        for (let i = 0; i < users.length; i += batchSize) {
            const batch = users.slice(i, Math.min(i + batchSize, users.length));

            // Create profile records in bulk
            console.log(`Creating profiles for batch of ${batch.length} users`);
            const profileInsertValues = batch.map(user =>
                `('${user.dataValues.phoneNumber}', '${teacherBotPhoneNumberId}', 'teacher')`
            ).join(',');

            const [profileResults] = await sequelize.query(`
                INSERT INTO wa_profiles (phone_number, bot_phone_number_id, profile_type)
                VALUES ${profileInsertValues}
                RETURNING profile_id, phone_number;
            `, { transaction });

            // Create a mapping of phone numbers to profile IDs
            const phoneToProfileMap = {};
            profileResults.forEach(row => {
                phoneToProfileMap[row.phone_number] = row.profile_id;
            });

            // Update each table in bulk for the batch
            for (const table of tables) {
                console.log(`Updating ${table} for batch of ${batch.length} users`);

                // Build the CASE statement for the update
                const caseStatements = batch.map(user =>
                    `WHEN '${user.dataValues.phoneNumber}' THEN ${phoneToProfileMap[user.dataValues.phoneNumber]}`
                ).join('\n          ');

                const phoneNumbers = batch.map(user => `'${user.dataValues.phoneNumber}'`).join(',');

                await sequelize.query(`
                    UPDATE ${table} 
                    SET profile_id = CASE "phoneNumber"
                          ${caseStatements}
                          ELSE profile_id
                    END
                    WHERE "phoneNumber" IN (${phoneNumbers});
                `, { transaction });
            }

            // Individual user logging (to maintain same output format)
            for (const user of batch) {
                counter++;
                const phoneNumber = user.dataValues.phoneNumber;
                const profileId = phoneToProfileMap[phoneNumber];

                console.log(`Processing user ${counter}/${users.length}: ${phoneNumber}`);
                console.log(`Creating profile for ${phoneNumber} with bot ID ${teacherBotPhoneNumberId}`);

                for (const table of tables) {
                    console.log(`Updating ${table} for user ${phoneNumber} with profile ID ${profileId}`);
                }

                // Progress indicator for large migrations
                if (counter % 100 === 0 || counter === users.length) {
                    console.log(`Processed ${counter}/${users.length} users`);
                }
            }
        }

        // Populate the active sessions table with the specified bot phone number ID
        console.log('Populating wa_active_sessions table...');
        await sequelize.query(`
            INSERT INTO wa_active_sessions (phone_number, bot_phone_number_id, profile_id)
            SELECT phone_number, '410117285518514', profile_id 
            FROM wa_profiles;
        `, { transaction });

        console.log('Migration completed successfully. Committing transaction...');
        await transaction.commit();
        console.log('Transaction committed. Migration Phase 1 complete!');

    } catch (error) {
        console.error('Migration failed:', error);
        console.log('Rolling back transaction...');
        await transaction.rollback();
        console.log('Transaction rolled back.');
        process.exit(1);
    }
}

/**
 * Phase 2: Update primary keys to use profile_id instead of phone_number
 * WARNING: Only run this after Phase 1 is verified and all data is correctly migrated
 */
async function updatePrimaryKeys() {
    if (!EXECUTE_PHASE_2) {
        console.log('Phase 2 is disabled. Set EXECUTE_PHASE_2 = true to execute primary key migration.');
        return;
    }

    const transaction = await sequelize.transaction();

    try {
        console.log('Starting Phase 2: Updating primary keys...');

        const tables = [
            'wa_users_metadata',
            'wa_user_progress',
            'wa_user_activity_logs',
            'wa_lessons_completed',
            'wa_question_responses',
            'wa_purchased_courses',
            'wa_feedback'
        ];

        // Change primary key for tables that use phone_number as primary key
        console.log('Changing primary key for wa_users_metadata...');
        await sequelize.query(`
            -- Create a temporary unique index on profile_id
            CREATE UNIQUE INDEX temp_idx_${Date.now()} ON wa_users_metadata(profile_id);
            
            -- Drop the existing primary key constraint
            ALTER TABLE wa_users_metadata DROP CONSTRAINT wa_users_metadata_pkey;
            
            -- Add the new primary key
            ALTER TABLE wa_users_metadata ADD PRIMARY KEY (profile_id);
        `, { transaction });

        console.log('Changing primary key for wa_user_progress...');
        await sequelize.query(`
            -- Create a temporary unique index on profile_id
            CREATE UNIQUE INDEX temp_idx_progress_${Date.now()} ON wa_user_progress(profile_id);
            
            -- Drop the existing primary key constraint
            ALTER TABLE wa_user_progress DROP CONSTRAINT wa_user_progress_pkey;
            
            -- Add the new primary key
            ALTER TABLE wa_user_progress ADD PRIMARY KEY (profile_id);
        `, { transaction });

        console.log('Phase 2 migration completed successfully. Committing transaction...');
        await transaction.commit();
        console.log('Transaction committed. Phase 2 complete!');

    } catch (error) {
        console.error('Phase 2 migration failed:', error);
        console.log('Rolling back transaction...');
        await transaction.rollback();
        console.log('Transaction rolled back.');
        process.exit(1);
    }
}

// Run the migrations
console.log('Starting migration script...');
migrateUsers()
    .then(() => {
        console.log('Phase 1 completed successfully, checking if Phase 2 should run...');
        return updatePrimaryKeys();
    })
    .then(() => {
        console.log('Migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Unhandled error in migration script:', error);
        process.exit(1);
    }); 