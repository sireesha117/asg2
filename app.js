const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("connected");
    });
  } catch (e) {
    console.log("catch error");
    process.exit();
  }
};

initializeDBAndServer();
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const registerSelect = `select * from user where username='${username}';`;
  const check = await db.get(registerSelect);
  console.log(check);
  if (check === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPass = await bcrypt.hash(password, 10);
      const registerUser = `insert into user (name,username,password,gender) values ('${name}','${username}','${hashedPass}','${gender}');`;
      await db.run(registerUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkQuery = `select * from user where username='${username}';`;
  const check = await db.get(checkQuery);
  if (check !== undefined) {
    const isPass = await bcrypt.compare(password, check.password);
    if (isPass) {
      const playLoad = { username: username };
      const jwtToken = jwt.sign(playLoad, "my_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//authantication
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_key", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//api3 get
const convertToRes = (item) => {
  return {
    username: item["username"],
    tweet: item["tweet"],
    dateTime: item["date_time"],
  };
};
const resultToResponse = (result) => {
  return result.map((item) => convertToRes(item));
};
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const selectQuery = `select user.username,tweet.tweet,tweet.date_time from (follower inner join tweet on tweet.user_id=follower.following_user_id) as T inner join user on user.user_id=T.user_id group by user.user_id order by tweet.date_time desc limit 4;`;
    const result = await db.all(selectQuery);
    const final = resultToResponse(result);
    response.send(final);
  }
);
module.exports = app;
