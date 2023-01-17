class CApiError{
    constructor(status, message){
        this.status = status
        this.message = message
    }

    static badRequest(message){
        return new CApiError(404, message)
    }

    static internal(message){
        return new CApiError(500, message)
    }

    static forbiden(message){ // no access
        return new CApiError(403, message)
    }
}

module.exports = CApiError