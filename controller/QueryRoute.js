const express = require("express");
const QuerySchema = require("../model/QuerySchema");

const QueryRoute = express.Router();

// Fetch all queries
QueryRoute.get("/", (req, res) => {
    QuerySchema.find((err, data) => {
        if (err) {
            return res.status(500).json({ message: "Failed to fetch Queries" });
        }
        res.json(data);
    });
});

// Add a new query
QueryRoute.post("/submit", (req, res) => {
    const { name, email, phno, query } = req.body;

    // Create a new query object
    const newQuery = new QuerySchema({
        name,
        email,
        phno,
        query,
    });

    // Save the query to the database
    newQuery.save((err, savedQuery) => {
        if (err) {
            return res.status(500).json({ message: "Failed to save query" });
        }
        res.status(201).json({ message: "Query submitted successfully", data: savedQuery });
    });
});

module.exports = QueryRoute;