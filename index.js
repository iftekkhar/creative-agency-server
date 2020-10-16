const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs-extra')
const admin = require('firebase-admin')
require('dotenv').config()
const port = 5000
const fileUpload = require('express-fileupload')
const ObjectId = require('mongodb').ObjectId

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.static('images'));
app.use(fileUpload())


var serviceAccount = require("./creative-agency-ia2020-firebase-adminsdk-bzb3u-240a35cb23.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://creative-agency-ia2020.firebaseio.com"
});


const MongoClient = require('mongodb').MongoClient;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.we61d.mongodb.net/creative-agency?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//Services API
client.connect(err => {
    // Registered Service DataBase Connection
    const services = client.db("creative-agency").collection("services");
    console.log('db 0 Connected')

    //Post API for NNew Service
    app.post('/new-service', (req, res) => {
        // Get Image from File
        const image = req.files.image;
        //Get Title, Description, Price from Body
        const title = req.body.title;
        const description = req.body.description;
        const price = req.body.price;
        const filePath = `${__dirname}/images/${image.name}`;
        console.log(image, title, description, price);
        image.mv(filePath, err => {
            if (err) {
                console.log(err);
                res.status(500).send({ msg: 'Failed to Upload' })
            }
        })
        const newImg = image.data;
        const encImg = newImg.toString('base64');
        // console.log('encImg', encImg)
        const dbImage = {
            contentType: req.files.image.mimetype,
            size: req.files.image.size,
            img: Buffer(encImg, 'base64')

        };

        services.insertOne({ title, description, price, dbImage })
            .then(result => {
                fs.remove(filePath, error => {
                    if (error) {
                        res.status(500).send({ msg: 'Failed to Upload' })
                        console.log(error)
                    }

                })
                res.send(result.insertedCount > 0);


            })
    })
    //Get API for Listing all Items
    app.get('/all-services', (req, res) => {
        services.find({})
            .toArray((err, documents) => {
                res.send(documents)
            })
    })
});



// FeedBack API
client.connect(err => {
    // Feedback DataBase Connection
    const feedbacks = client.db("creative-agency").collection("feedbacks");
    console.log('db 1 Connected')
    //Post API for Event Registration
    app.post('/new-feedback', (req, res) => {
        const newEvent = req.body;
        feedbacks.insertOne(newEvent)
            .then(result => {
                console.log(result);
                res.send(result.insertedCount > 0);
            })
    })
    //Get API for Listing all Items
    app.get('/all-feedbacks', (req, res) => {
        feedbacks.find({})
            .toArray((err, documents) => {
                res.send(documents)
            })
    })
});

//isAdmin /addAdmin API 
client.connect(err => {
    // Feedback DataBase Connection
    const superAdmin = client.db("creative-agency").collection("admin");
    console.log('db admin Connected')
    //Post API for Event Registration
    app.post('/isAdmin', (req, res) => {
        superAdmin.find({ email: req.query.email })
            .toArray((err, admins) => {
                res.send(admins.length > 0);
            })
    })
    //Post API for Admin Registration
    app.post('/add-admin', (req, res) => {
        const newEvent = req.body;
        superAdmin.insertOne(newEvent)
            .then(result => {
                console.log(result);
                res.send(result.insertedCount > 0);
            })
    })
});



//Orders API
client.connect(err => {
    // All orders DataBase Connection
    const orders = client.db("creative-agency").collection("orders");
    const superAdmins = client.db("creative-agency").collection("admin");
    console.log('db 2 Connected')

    //Post API for Volunteer Registration
    app.post('/new-order', (req, res) => {
        const newRegistration = req.body;
        orders.insertOne(newRegistration)
            .then(result => {
                console.log(result);
                res.send(result.insertedCount > 0);
            })
    })

    //Get API for Individual User /Admin Access
    app.get('/my-orders', (req, res) => {
        const bearer = req.headers.authorization;
        if (bearer && bearer.startsWith('Bearer ')) {
            const idToken = bearer.split(' ')[1];

            // idToken comes from the client app
            admin.auth().verifyIdToken(idToken)
                .then(function (decodedToken) {
                    let uid = decodedToken.uid;
                    //Checking if user is an Admin
                    superAdmins.find({ email: req.query.email })
                        .toArray((err, documents) => {
                            if (documents.length !== 0) {
                                //Show all Order data
                                orders.find({})
                                    .toArray((err, doc) => {
                                        res.send(doc)
                                    })
                                console.log('is an Admin')
                            }
                            else {
                                // Show loggedIn User Data only
                                orders.find({ email: req.query.email })
                                    .toArray((err, data) => {
                                        res.send(data)
                                    })
                                console.log('Not an Admin')
                            }
                        })


                }).catch(function (error) {
                    // Handle error
                });
        }
        else {
            res.status(401).send('Sorry ! Unauthorized Access')
        }


    })
});



app.get('/', (req, res) => {
    res.send('Server Running')
})

app.listen(port)