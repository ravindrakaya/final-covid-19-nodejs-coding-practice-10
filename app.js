const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// Authentication with Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  //console.log(authHeaders);
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
    //console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
        // console.log(payload);
      }
    });
  }
};

// 1. Log in API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `SELECT * FROM user WHERE username = "${username}";`;
  const dbUser = await db.get(selectQuery);
  //console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    //console.log(isPasswordMatched);
    if (isPasswordMatched) {
      //console.log("Success");
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// 2. Get API >> Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`;
  const statesList = await db.all(getStatesQuery);
  response.send(
    statesList.map((eachObj) => ({
      stateId: eachObj["state_id"],
      stateName: eachObj["state_name"],
      population: eachObj["population"],
    }))
  );
});

// 3. Get API >> Returns a state based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateList = await db.get(getStateQuery);
  response.send({
    stateId: stateList["state_id"],
    stateName: stateList["state_name"],
    population: stateList["population"],
  });
});

// 4. Post API >> Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO district
                                    (district_name, state_id, cases, cured, active, deaths)
                                    VALUES (
                                        "${districtName}",${stateId},${cases},${cured},${active},${deaths}
                                    );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// 5. Get API >> Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const districtList = await db.get(getDistrictQuery);
    response.send({
      districtId: districtList["district_id"],
      districtName: districtList["district_name"],
      stateId: districtList["state_id"],
      cases: districtList["cases"],
      cured: districtList["cured"],
      active: districtList["active"],
      deaths: districtList["deaths"],
    });
  }
);

// 6. Delete API >> Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

// 7. Put API >> Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district
                                SET 
                                  district_name = "${districtName}",
                                  state_id = ${stateId},
                                  cases = ${cases},
                                  cured = ${cured},
                                  active = ${active},
                                  deaths = ${deaths};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// 8. Get API >> Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statQuery = `SELECT SUM(cases) AS totalCases,
                                SUM(cured) AS totalCured,
                                SUM(active) AS totalActive,
                                SUM(deaths) AS totalDeaths
                                FROM district
                                WHERE state_id = ${stateId};`;
    const statList = await db.get(statQuery);
    response.send(statList);
  }
);

module.exports = app;
