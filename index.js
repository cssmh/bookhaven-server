const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "https://bookshare-c1817.web.app",
      "https://bookhaven1.netlify.app",
      "https://open-rest.surge.sh",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyTokenFirst = async (req, res, next) => {
  const token = req?.cookies?.token;
  //   console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      res.status(401).send({ message: "unauthorized access" });
    } else {
      req.decodedUser = decoded;
      next();
    }
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vkpbftc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //  await client.connect();

    const bookCollection = client.db("bookHaven").collection("books");
    const bookingCollection = client.db("bookHaven").collection("bookings");
    const emailCollection = client.db("bookHaven").collection("emails");

    app.post("/jwt", async (req, res) => {
      try {
        const userEmail = req.body;
        // console.log("user for token", userEmail);
        const getToken = jwt.sign(userEmail, process.env.ACCESS_TOKEN, {
          expiresIn: "5d",
        });
        res
          .cookie("token", getToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
          })
          .send({ success: true });
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/logout", async (req, res) => {
      try {
        // const user = req.body;
        // console.log(user);
        res.clearCookie("token", { maxAge: 0 }).send({ success: true });
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/all-books", async (req, res) => {
      try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const skipIndex = (page - 1) * limit;

        const cursor = bookCollection.find().skip(skipIndex).limit(limit);
        const result = await cursor.toArray();
        const totalBooks = await bookCollection.countDocuments();
        res.send({ totalBooks, result });
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/my-books", async (req, res) => {
      try {
        let query = {};
        if (req.query?.email) {
          query = { book_provider_email: req.query.email };
        }
        const result = await bookCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/emails", async (req, res) => {
      try {
        const result = await emailCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/book/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/my-bookings", verifyTokenFirst, async (req, res) => {
      try {
        // console.log(req.cookies);
        if (req.decodedUser.email !== req.query.email) {
          return res.status(403).send({ message: "forbidden access" });
        }

        let query = {};
        if (req.query?.email) {
          query = { user_email: req.query.email };
        }
        const cursor = bookingCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/my-pending", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser.email !== req.query?.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        let query = {};
        if (req.query?.email) {
          query = { book_provider_email: req.query.email };
        }
        const cursor = bookingCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/unavailable-ids", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser.email !== req.query?.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const query = {
          book_status: "Unavailable",
          book_provider_email: req.query?.email,
        };
        const options = {
          projection: { _id: 1 },
        };
        const cursor = bookCollection.find(query, options);
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/email", async (req, res) => {
      try {
        const emailData = req.body;
        const result = await emailCollection.insertOne(emailData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/book", async (req, res) => {
      try {
        const bookData = req.body;
        const result = await bookCollection.insertOne(bookData);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.post("/add-booking", async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.put("/book/:id/:email", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== req.params?.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const filter = { _id: new ObjectId(req.params?.id) };
        const options = { upsert: true };
        const updatedBookData = req.body;
        const updated = {
          $set: {
            book_name: updatedBookData.book_name,
            book_image: updatedBookData.book_image,
            book_provider_phone: updatedBookData.book_provider_phone,
            provider_location: updatedBookData.provider_location,
            description: updatedBookData.description,
          },
        };
        const result = await bookCollection.updateOne(filter, updated, options);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // update booking status by provider
    app.put(
      "/booking-status/:id/:email",
      verifyTokenFirst,
      async (req, res) => {
        try {
          if (req.decodedUser?.email !== req.params?.email) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          const filter = { _id: new ObjectId(req.params?.id) };
          const options = { upsert: true };
          const updateStatus = req.body;
          const updated = {
            $set: {
              status: updateStatus.updatedPendingStatus,
            },
          };
          const result = await bookingCollection.updateOne(
            filter,
            updated,
            options
          );
          res.send(result);
        } catch (err) {
          console.log(err);
        }
      }
    );

    // book status update (available or not)
    app.put("/book-status/:id/:email", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== req.params?.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const idx = req.params.id;
        const filter = { _id: new ObjectId(idx) };
        const options = { upsert: true };
        const updatedStatus = req.body;
        const updated = {
          $set: {
            book_status: updatedStatus.bookStatus,
          },
        };
        const result = await bookCollection.updateOne(filter, updated, options);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // send completed time to booking data while completed
    app.put("/add-time/:id/:email", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== req.params?.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const filter = { _id: new ObjectId(req.params?.id) };
        const updated = {
          $set: {
            completed_at: req.body.todayDateTime,
          },
        };
        const result = await bookingCollection.updateOne(filter, updated, {
          upsert: true,
        });
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // update user name and photo from profile will update all his book
    // his photo and name also
    app.put("/my-all-books/:email", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== req.params?.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const filter = {
          book_provider_email: req.params?.email,
        };
        const updatedMyAllBookData = req.body;
        const updatedInfo = {
          $set: {
            book_provider_name: updatedMyAllBookData.name,
            book_provider_image: updatedMyAllBookData.photo,
          },
        };
        const result = await bookCollection.updateMany(filter, updatedInfo);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.delete("/book/:id/:email", verifyTokenFirst, async (req, res) => {
      try {
        const userEmail = req.decodedUser?.email;
        if (
          userEmail !== "admin@admin.com" &&
          userEmail !== req.params?.email
        ) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        const idx = req.params.id;
        const query = { _id: new ObjectId(idx) };
        const result = await bookCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // admin special use here
    app.get("/all-bookings", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== "admin@admin.com") {
          return res.status(403).send({ message: "admin authorized only" });
        }
        const result = await bookingCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.put("/available-all-books", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== "admin@admin.com") {
          return res.status(403).send({ message: "admin authorized only" });
        }
        const options = { upsert: true };
        const updated = {
          $set: {
            book_status: "available",
          },
        };
        const result = await bookCollection.updateMany({}, updated, options);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.put("/update-to-pending", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== "admin@admin.com") {
          return res.status(403).send({ message: "admin authorized only" });
        }
        // Define filter to find documents with status "Completed"
        // and completed_at field exists
        const filter = { status: "Completed", completed_at: { $exists: true } };
        const update = {
          $set: {
            status: "Pending",
          },
          //unset means delete that field
          $unset: {
            completed_at: 1,
          },
        };
        const result = await bookingCollection.updateMany(filter, update);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.delete("/booking/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.delete("/all-bookings", verifyTokenFirst, async (req, res) => {
      try {
        if (req.decodedUser?.email !== "admin@admin.com") {
          return res.status(403).send({ message: "admin authorized only" });
        }
        const result = await bookingCollection.deleteMany();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    // admin special use here end

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BOOKS ARE YOURS");
});

app.listen(port, () => {
  console.log(`SERVER RUNNING ON PORT ${port}`);
});
