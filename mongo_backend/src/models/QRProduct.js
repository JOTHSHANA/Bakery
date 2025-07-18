const mongoose = require("mongoose");

const QRProductSchema = new mongoose.Schema(
  {
    product_code: { type: String, required: true, unique: true, trim: true },
    product_name: { type: String, required: true,unique: true, trim: true },
    product_price: { type: mongoose.Decimal128, required: true },
    product_quantity: { type: Number, required: true },
    qr_code: { type: String, required: false },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },
    status: { type: String, enum: ["0", "1"], default: "1" },
  },
  { timestamps: true }
);

QRProductSchema.index({ product_name: "text", product_code: "text" });
QRProductSchema.index({ status: 1 });
QRProductSchema.index({ status: 1, location: 1 });

module.exports = mongoose.model("QRProduct", QRProductSchema);
