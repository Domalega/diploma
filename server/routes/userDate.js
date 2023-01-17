const Router = require('express')
const userDateController = require('../controllers/userDateController') 


const router = new Router()

router.post('/create', userDateController.create) //for create new note
router.get('/get', userDateController.getAll) //for getting all notes
router.delete('/delete', userDateController.delete) // for delete note

module.exports = router