import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';
dotenv.config();

export default async function generateToken(email) {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '30d' })
    return token
}