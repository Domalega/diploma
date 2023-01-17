require('dotenv').config();
const express = require('express')
const cors = require('cors')
const sequelize = require('./bd')
const models = require('./models/models')
const router = require('./routes/index')
const errorHandler = require('./middleware/ErrorHandleMiddleware');


const PORT = process.env.PORT || 5000;

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', router)

//Обработчик ошибок
app.use(errorHandler)


const start = async () =>{
    try {
        await sequelize.authenticate();//connect to db
        await sequelize.sync();//check model to db
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    } catch (error) {
        
    } 
}

start();