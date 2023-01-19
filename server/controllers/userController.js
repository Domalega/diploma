const {UserDate, User} = require('../models/models');
const ApiError = require('../errors/ApiError')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const { json } = require('sequelize');



class CUserContoller {
    async regestration(req, res, next){
        const {email, password, fullName} = req.body
        if(!email || !password || !fullName)
            return next(ApiError.badRequest('Uncorrect data'))

        const usedEmail = await User.findOne({where: {email}})
        if(usedEmail)
            return next(ApiError.badRequest('User is already have with this email'))

        const hashPassword = await bcrypt.hash(password, 5)
        const user = await User.create({email, password: hashPassword, fullName})
        const token = jwt.sign(
            {id: user.id, email: user.email, fullName: user.fullName}, 
            process.env.SECRET_KEY,
            {expiresIn: '24h'}
        )

        return res.json(token)
    }

    async login(req, res){

    }

    async check(req, res, next){
    }
}

module.exports = new CUserContoller()