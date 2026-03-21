const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
require("dotenv").config()

const repoRoutes = require('./routes/repo')

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend running" })
})

app.use('/api/repo', repoRoutes)

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected")
    app.listen(8000, () =>
      console.log(`Server running on port 8000`)
    )
  })
  .catch((err) => console.error("MongoDB error:", err))
