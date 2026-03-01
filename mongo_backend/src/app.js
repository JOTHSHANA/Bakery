const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const morgan = require("morgan");

const connectDB = require("./config/database");
const routes = require("./routes/routes");

const app = express();
const server = http.createServer(app);

connectDB();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.use("/public", express.static(path.join(__dirname, "public")));
app.use(routes);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});