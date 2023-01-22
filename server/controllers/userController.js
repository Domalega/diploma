const {UserDate, User} = require('../models/models');
const ApiError = require('../errors/ApiError')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const { json } = require('sequelize');
const { validationResult } = require('express-validator');

const generateToken = (id, email) =>{
    return jwt.sign(
            {id: id, email: email}, 
            process.env.SECRET_KEY,
            {expiresIn: '24h'}
        )
}
class CUserContoller {
    async regestration(req, res, next){
        const {email, password, fullName} = req.body
        if(!email || !password || !fullName)
            return next(ApiError.badRequest('Uncorrect data'))

        const usedEmail = await User.findOne({where: {email}})
        if(usedEmail)
            return next(ApiError.badRequest('User is already have with this email'))


        const errors = validationResult(req);
        if (!errors.isEmpty()) 
            return next(ApiError.badRequest('Wrong password'))
            

        const hashPassword = await bcrypt.hash(password, 5)
        const user = await User.create({email, password: hashPassword, fullName})
        const token = generateToken(user.id, user.email)

        return res.json(token)
    }

    async login(req, res, next){
        const {email, password} = req.body
        const user = await User.findOne({where:{email}})
        if(!user)
            return next(ApiError.badRequest('User not found'))

        let comparePassword = bcrypt.compareSync(password, user.password)
        if(!comparePassword)
            return next(ApiError.badRequest('Password or login is wrong'))

        const token = generateToken(user.id, user.email)
        return res.json({token})
    }

    async check(req, res, next){
        res.json({m: "test"})
    }
}

module.exports = new CUserContoller()