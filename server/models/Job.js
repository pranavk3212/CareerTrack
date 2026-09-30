const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Applied", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },

    date: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    jobUrl: {
      type: String,
      default: "",
      trim: true,
    },

    contact: {
      type: String,
      default: "",
      trim: true,
    },

    salary: {
      type: String,
      default: "",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
    },

    // Interview tracking
    interviewDate: {
      type: String,
      default: "",
    },

    interviewTime: {
      type: String,
      default: "",
    },

    interviewLink: {
      type: String,
      default: "",
      trim: true,
    },

    interviewer: {
      type: String,
      default: "",
      trim: true,
    },

    interviewNotes: {
      type: String,
      default: "",
    },

    // Follow-up tracking
    followUpDate: {
      type: String,
      default: "",
    },

    nextAction: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Job", jobSchema);