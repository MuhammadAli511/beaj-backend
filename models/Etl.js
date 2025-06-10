import { Model } from "sequelize";
import sequelize from "../config/sequelize.js";
class Etl extends Model { }
Etl.init(
    {},
    {
        sequelize,
        modelName: "etl",
        tableName: "beaj_employees",
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ["email"],
            },
        ],
    }
);
export default Etl;