const Router = require('express')
const userController = require('../controllers/userController')
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware')


const router = new Router()

router.post('/registration', body('email').isEmail(), userController.regestration)
router.post('/login', userController.login)
router.get('/auth', authMiddleware, userController.check)

module.exports = router