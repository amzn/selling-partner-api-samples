import express from 'express'
import fs from 'fs'

const app = express()
const port = 3000

app.use(express.json())

app.use('/resources', express.static('./resources'))

app.post('/auth/o2/token', (req, res) => {
    res.json({
        access_token: 'accessToken',
        refresh_token: 'refreshToken',
        token_type: 'bearer',
        expires_in: 3600
    })
})

app.post('/responses', (req, res) => {
    console.log('Set new set of responses')
    app.locals.response = req.body
    app.locals.index = 0
    console.log('Responses: ' + app.locals.response)
    console.log('Index: ' + app.locals.index)
    res.status(204).send()
})

app.all('*', (req, res) => {
    console.log('Incoming request: ' + req.path)
    const path = './responses/' + app.locals.response[app.locals.index] + '.json'
    console.log('Path: ' + path)
    if (app.locals.response[app.locals.index] !== '' && fs.existsSync(path)) {
        app.locals.index += 1
        const response = fs.readFileSync(path, {encoding: 'utf-8'})
        res.status(200).json(JSON.parse(response))
    } else {
        res.status(204).send()
    }
})

app.listen(port, () => {})