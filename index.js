const express = require("express")
const app = express() // to work on express we make a variable
app.use(express.json());
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()


app.use(cors())
const stripe = require("stripe")(process.env.SECRET_KEY);

const port = process.env.PORT || 5000 // make the port to run

app.get("/", (req, res) => {
    res.send("Zap shift server is running")
})

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString('utf-8')
const serviceAccount = JSON.parse(decoded);


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// mongodb 


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.7hhwads.mongodb.net/?appName=Cluster0`;
// console.log(uri)
// const uri = "mongodb://127.0.0.1:27017";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        const db = client.db("zap_shift-user_db")
        // collection 
        const parcelCollection = db.collection("parcels")
        const paymentCollection = db.collection("payments")
        const userCollection = db.collection("users")
        const riderCollection = db.collection("riders")



        // jwt verify 
        const verifyFBToken = async (req, res, next) => {
            // next()


            const token = req.headers.authorization?.split(" ")[1]
            if (!token) {
                return res.status(401).send({ message: "Unauthorized Access " })
            }
            try {
                const decoded = await admin.auth().verifyIdToken(token)
                req.decodedEmail = decoded.email
                next()
            }
            catch (error) {
                return res.status(403).send({ message: "Unauthorized Access" })
            }


        }
        //admin verify
        const verifyAdmin = async (req, res, next) => {
            // next()




            const email = req.decodedEmail
            const query = { email }
            const options = {
                projection: { role: 1, _id: 0 }
            }
            const result = await userCollection.findOne(query, options)
            if (result.role !== "admin") {
                return res.status(403).send({ message: "Unauthorized Access" })

            } else if (result.role === "admin") {
                return next()
            }



        }
        app.get("/parcel", verifyFBToken, async (req, res) => {
            const { id, parcelId } = req.query
            let query = {}
            if (id) {
                query = { _id: new ObjectId(id) }

            }
            if (parcelId) {
                query = { parcelId }
            }
            const result = await parcelCollection.findOne(query)
            res.send(result)
        })

        app.get("/parcels", verifyFBToken, async (req, res) => { // xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx verifyFbToken
            const { email, search, riderEmail, status, skip, limit } = req.query
            // make query
            let query = {}
            let sort = { _id: -1 }

            if (email) {
                query = { userEmail: email }
            }
            if (search) {
                query.parcelName = { $regex: search, $options: "i" }
                sort = {}
            }
            // rider assigned parcels
            if (riderEmail && status) {
                query = { "rider.riderEmail": riderEmail }
                if (Array.isArray(status)) {
                    query.parcel_status = { $in: status }
                }
                else {
                    query.parcel_status = status
                }

            }

            const result = await parcelCollection.find(query).sort(sort).skip(Number(skip) || 0).limit(Number(limit) || 0).toArray()
            if (skip || limit) {
                const totalDataCount = await parcelCollection.countDocuments(query)
                res.send({ result, totalDataCount })
                return
            }
            res.send(result)
        })
        app.patch("/parcel/:id", async (req, res) => {
            const { id } = req.params
            const { status, riderEmail } = req.body
            const query = { _id: new ObjectId(id) }
            const now = new Date()
            const update = {
                $set: {
                    parcel_status: status,
                },
                $push: {
                    statusHistory: { status: status, time: now }

                }
            }
            if (status === "delivered") {
                const riderQuery = { email: riderEmail }
                const update = { $inc: { currentAssignedParcels: -1, completedDeliveries: 1 } }
                await riderCollection.updateOne(riderQuery, update)
            }
            const result = await parcelCollection.updateOne(query, update)
            res.send(result)
        })
        app.post("/parcels", async (req, res) => {
            const today = new Date()
            const date = today.toISOString().split("T")[0].replaceAll("-", "")
            const random = Math.random().toString(36).slice(2, 8).toUpperCase()
            const parcelId = `PCL-${date}-${random}`
            const data = req.body
            data.parcelId = parcelId
            data.createdAt = today
            data.statusHistory = [{ status: data.parcel_status, time: today }]
            const result = await parcelCollection.insertOne(data)
            result.parcelId = parcelId
            res.send(result)
        })
        app.delete("/parcel", async (req, res) => {
            const { id } = req.query
            const query = { _id: new ObjectId(id) }
            const result = await parcelCollection.deleteOne(query)
            res.send(result)
        })
        // CARD PAYMENT
        app.post('/create-payment-intent', async (req, res) => {
            try {
                // You can get data from the request body
                const { amount, currency = 'usd' } = req.body;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount || 2000, // Amount in cents
                    currency,
                    // automatic_payment_methods: {
                    //     enabled: true,
                    // },
                    // metadata,
                });

                res.json({
                    clientSecret: paymentIntent.client_secret
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // PAYMENT RELATED CODES
        app.get("/payments", verifyFBToken, async (req, res) => {
            const data = req.query.email
            if (req.decodedEmail !== data) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            const query = { email: data }
            const result = await paymentCollection.find(query).sort({ _id: -1 }).toArray()
            res.send(result)
        })
        app.post("/payments", async (req, res) => {
            const data = req.body
            const time = new Date()
            data.time = time
            // PATCH Payment status
            const query = {
                parcelId: data.parcelId
            }
            const update = {
                $set: { paymentStatus: true }
            }
            await parcelCollection.updateOne(query, update, { upsert: true })
            const result = await paymentCollection.insertOne(data)
            res.send(result)
        })
        // USER RELATED CODE ..............................................
        app.get("/user", verifyFBToken, async (req, res) => {
            const { uid, email } = req.query
            let query = {}
            if (uid) {
                query.uid = uid
            }
            else if (email) {
                query.email = email
            }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        app.get("/users&admin", verifyFBToken, async (req, res) => {
            const { name } = req.query
            const query = {
                role: { $in: ["user", "admin"] }
            }
            if (name) {
                query.name = { $regex: name, $options: "i" }
            }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
        app.post("/users", async (req, res) => {
            const data = req.body
            const query = { email: data.email }
            const userExits = await userCollection.findOne(query)
            if (userExits) {
                return res.send({ message: "User Exits" })
            }
            data.role = "user"
            data.created_At = new Date()
            data.lastActiveAt = new Date()
            const result = await userCollection.insertOne(data)
            res.send(result)
        })
        app.patch("/user/:id", verifyFBToken, async (req, res) => {
            const { id } = req.params
            const data = req.body
            const query = {
                _id: new ObjectId(id)
            }
            if (!data.role) {
                data.updatedAt = new Date()
            }
            const update = {
                $set: data
            }
            const result = await userCollection.updateOne(query, update)
            res.send(result)
        })

        // RIDER RELATED CODES for admin

        app.get("/riders", verifyFBToken, verifyAdmin, async (req, res) => {
            // all rider 
            // search rider,
            // specific warehouse rider
            const { search, district, status, skip, limit } = req.query
            let query = {}
            let sort = {}
            if (status) {
                query.status = status
                sort._id = -1

            }
            if (search) {
                query.name = { $regex: search, $options: "i" }
                sort = {}
            }
            if (district) {
                query.district = district
            }
            const result = await riderCollection.find(query).sort(sort).skip(Number(skip) || 0).limit(Number(limit) || 0).toArray()
            if (skip || limit) {
                const totalDataCount = await riderCollection.countDocuments(query)
                res.send({ result, totalDataCount })
                return
            }
            res.send(result)
            // console.log(totalDataCount)
        })

        app.get("/pending-riders", verifyFBToken, verifyAdmin, async (req, res) => {
            const { search } = req.query
            const query = { status: { $regex: "pending", $options: "i" } }
            if (search) {
                query.name = { $regex: search, $options: "i" }
            }
            const result = await riderCollection.find(query).toArray()
            res.send(result)
        })

        app.get("/rider-application/check", async (req, res) => {
            const email = req.query.email

            if (!email) {
                res.send({ message: "Email Is Required" })
            }

            const result = await riderCollection.findOne({ email })

            res.send(result)


        })
        app.post("/riders-request", async (req, res) => {
            const data = req.body
            const date = new Date()
            data.created_At = date
            data.status = "pending"
            const result = await riderCollection.insertOne(data)
            res.send(result)
        })





        // update rider status 
        app.patch("/pending-riders", verifyFBToken, verifyAdmin, async (req, res) => {
            const data = req.body
            const { id } = req.query
            // console.log(id)
            const query = {
                _id: new ObjectId(id)
            }
            // const normalizedStatus = data.status === "deactivated" ? "inactive" : data.status === "approved" ? "activate" : data.status
            const updateData = {
                status: data.status
            }
            if (data.new) {
                updateData.joinedAt = new Date()
                // initial data
                updateData.currentAssignedDeliveries = 0
                updateData.completedDeliveries = 0
            }
            const update = {
                $set: updateData
            }
            const result = await riderCollection.updateOne(query, update, { upsert: false })
            //........
            if (data.status === "active") {
                const user = await riderCollection.findOne(query)
                const queryUser = {
                    email: user.email
                }
                const updateUser = {
                    $set: {
                        role: "rider"
                    }
                }
                await userCollection.updateOne(queryUser, updateUser, { upsert: false })
            }

            res.send(result)
        })
        // admin related code******************************************************
        app.get('/admin/parcels', verifyFBToken, verifyAdmin, async (req, res) => {
            const { parcel_status, payment_status } = req.query
            let sort = { _id: -1 }

            const query = {
                paymentStatus: Boolean(payment_status),
                parcel_status
            }
            const result = await parcelCollection.find(query).sort(sort).toArray()
            res.send(result)
        })

        app.get("/role/:email", verifyFBToken, async (req, res) => {
            const { email } = req.params
            const options = {
                projection: { role: 1, _id: 0 }
            }
            const result = await userCollection.findOne({ email }, options)
            res.send(result)
        })
        // rider assign************************************************************************

        app.patch("/assign-rider", verifyFBToken, verifyAdmin, async (req, res) => {
            const { parcelId, riderId, riderEmail } = req.body
            const status = "rider-assigned"
            const now = new Date()
            const query = { parcelId }
            const update = {
                $set: {
                    parcel_status: status,
                    rider: { riderId, riderEmail }
                },
                $push: {
                    statusHistory: { status: status, time: now }
                }
            }
            const parcelResult = await parcelCollection.updateOne(query, update, { upsert: false })
            // find out rider using rider id 
            // increment 1 the value of currentAssignedParcels

            const riderQuery = {
                _id: new ObjectId(riderId)
            }
            const riderUpdate = {
                $inc: {
                    currentAssignedParcels: 1
                }
            }
            const riderResult = await riderCollection.updateOne(riderQuery, riderUpdate)
            res.send(parcelResult)
        })
        // updating active status 
        app.patch("/users/last-active", async (req, res) => {
            const { uid } = req.body
            // console.log(uid)
            const update = {
                $set: { lastActiveAt: new Date() }
            }
            const result = await userCollection.updateOne({ uid }, update)
            // console.log("result", result)
            res.send(result)
        })

        // others 
        app.get("/total-delivery-count", verifyFBToken, async (req, res) => {
            const query = { parcel_status: "delivered" }
            const result = await parcelCollection.countDocuments(query)
            res.send(result)
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
app.listen(port, () => {
    console.log(`Server is running on port:${port}`)
})
