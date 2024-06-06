export default async function generateToken(email) {
    const token = await jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '30d' })
    return token
}