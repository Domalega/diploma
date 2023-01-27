const {UserDate} = require('../models/models');
const ApiError = require('../errors/ApiError');
const { json } = require('sequelize');


class CUserDateContoller {
    async create(req, res, next){
        try{
            const {date, comment} = req.body
            const type = await UserDate.create({date, comment, userId})
            return res.json(type)
        }   catch(error){
            next(ApiError.badRequest(error.message))
        }

    }

    async getAll(req, res){
        try{
            const all = await UserDate.findAll()
            return res.json(all)
        } catch(error){
            next(ApiError.badRequest(error.message))
        }
    } 

    async delete(req, res){
    }
}

module.exports = new CUserDateContoller()