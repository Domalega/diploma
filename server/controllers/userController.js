const {Type} = require('../models/models');
const ApiError = require('../errors/ApiError')


class CUserContoller {
    async regestration(req, res){

    }

    async login(req, res){

    }

    async check(req, res, next){
        const {id} = req.query
        if(!id)
            return next(ApiError.badRequest('No id!'))
        res.json(id)
    }
}

module.exports = new CUserContoller()