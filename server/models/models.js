const sequelize = require('../bd')
const {DataTypes, Model} = require('sequelize')

const User = sequelize.define('user',{
    id: {
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
    },

    email: {
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false,
    },

    password: {
        type: DataTypes.STRING,
        allowNull: false, 
    },

    fullName: {
        type: DataTypes.STRING,
        allowNull: false,
    }
})

const UserDate = sequelize.define('userDate',{
    id: {
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
    },

    date:{
        type: DataTypes.DATE,
        unique: true,
        allowNull: false,
    },

    comment:{
        type: DataTypes.STRING,
        allowNull: true,
    }

})

User.hasOne(UserDate);
UserDate.belongsTo(User);

module.exports = {
    User,
    UserDate,
}