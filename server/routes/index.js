const Router = require('express')
const userRouter = require('./user')
const userDateRouter = require('./userDate')


const router = new Router()

router.use('/user', userRouter)
router.use('/userDate', userDateRouter)

module.exports = router