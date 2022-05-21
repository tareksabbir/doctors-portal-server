const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4fjcw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    // console.log(token)
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const usersCollection = client.db('doctors_portal').collection('users');


        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.get('/user', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });

        })

        // this is note the best way but for study purpose i just used 
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            const services = await serviceCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.doctor === service.doctor);
                const bookedSlots = serviceBookings.map(book => book.slot);
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(services);
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { doctor: booking.doctor, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

        /********* 
        * Api name
        * app.get('/booking') // get all booking
        * app.get('/booking/:id') // get one or specifice booking
        * app.post('/booking') // add new booking
        * app.patch('/booking/:id') // update booking
        * app.put('/users') // thakle dhukabe na thakle notun kore add korbe 
        * app.delete('/booking') // delete one booking
        * ***************/

    } finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello From doctors hub server!')
})

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})