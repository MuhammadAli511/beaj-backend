import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config();

export default async function interalUsersAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: 'Unauthorized' });
            }
            return decoded;
        });

        if (decoded.email == "info@beaj.org") {
            return res.status(401).send({ message: 'Unauthorized' });
        }

        req.email = decoded.email;
        next();
    } catch (error) {
        return res.status(401).send({ message: error.message });
    }
}
