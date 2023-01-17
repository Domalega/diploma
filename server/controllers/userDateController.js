const {UserDate} = require('../models/models');
const ApiError = require('../errors/ApiError');
const { json } = require('sequelize');


class CUserDateContoller {
    async create(req, res, next){
        try{
            const {date, comment} = req.body
            const type = await UserDate.create({date, comment})
            return res.json(type)
        }   catch(error){
            next(ApiError.badRequest(error.message))
        }

    }

    async getAll(req, res){
        const all = await UserDate.findAll()
        return res.json(all)
    } 

    async delete(req, res){
    }
}

module.exports = new CUserDateContoller()