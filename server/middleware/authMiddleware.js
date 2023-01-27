const ApiError = require('../errors/ApiError')
const jwt = require('jsonwebtoken')


module.exports = function(req, res, next){
    if(req.method == "OPTIONS")
        next()
    
    try {
        const token = req.headers.authorization.split(' ')[1]
        if(!token)
            return res.status(401).json({message: "unauthorized user"})

        const decode = jwt.verify(token, process.env.SECRET_KEY)
        req.user = decode
        next()

    } catch (error) {
        console.log(error)
        res.status(401).json({message: "unauthorized user"})
    }
}