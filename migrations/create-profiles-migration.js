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

        // 1. Create the new profile table
        console.log('Creating wa_user_profiles table...');
        await sequelize.query(`
            CREATE TABLE public.wa_profiles (
                profile_id serial PRIMARY KEY,
                phone_number text NOT NULL,
                bot_phone_number_id text NOT NULL,
                profile_type text CHECK (profile_type IN ('teacher', 'student')),
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
        for (const user of users) {
            counter++;
            const phoneNumber = user.dataValues.phoneNumber;
            console.log(`Processing user ${counter}/${users.length}: ${phoneNumber}`);
            const botId = teacherBotPhoneNumberId;

            // Create profile record
            console.log(`Creating profile for ${phoneNumber} with bot ID ${botId}`);
            const [result] = await sequelize.query(`
        INSERT INTO wa_profiles (phone_number, bot_phone_number_id, profile_type)
        VALUES (:phoneNumber, :botId, 'teacher')
        RETURNING profile_id;
      `, {
                replacements: { phoneNumber, botId },
                type: sequelize.QueryTypes.INSERT,
                transaction
            });

            const profileId = result[0].profile_id;

            // 5. Update records in each table to set the profile_id
            for (const table of tables) {
                console.log(`Updating ${table} for user ${phoneNumber} with profile ID ${profileId}`);
                await sequelize.query(`
          UPDATE ${table} 
          SET profile_id = :profileId 
          WHERE "phoneNumber" = :phoneNumber;
        `, {
                    replacements: { profileId, phoneNumber },
                    transaction
                });
            }

            // Progress indicator for large migrations
            if (counter % 100 === 0 || counter === users.length) {
                console.log(`Processed ${counter}/${users.length} users`);
            }
        }

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

        for (const table of tables) {
            console.log(`Making profile_id NOT NULL in ${table}...`);
            await sequelize.query(`
                ALTER TABLE ${table}
                ALTER COLUMN profile_id SET NOT NULL;
            `, { transaction });
        }

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