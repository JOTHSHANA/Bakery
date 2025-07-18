const fs = require("fs");
const path = require("path");
const { post_database, get_database } = require("../../config/db_utils");

exports.post_qr_products = async (req, res) => {
  try {
    const { product_id, name, price, quantity } = req.body;
    const qrImage = req.file;

    if (!product_id || !name || !price || !quantity) {
      return res.status(400).json({ error: "All fields are required" });
    }

    let qr_Path = "";
    if (qrImage) {
      const uploadDir = path.join(__dirname, "../../public/qr-codes");
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      const fileName = `${product_id}.png`;
      const filePath = path.join(uploadDir, fileName);

      fs.writeFileSync(filePath, qrImage.buffer);
      qr_Path = `qr-codes/${fileName}`;
    }
    const checkQuery = `
      SELECT id , product_quantity, qr_code FROM qr_products 
      WHERE  product_name = ? 
      LIMIT 1
    `;
    const matched = await get_database(checkQuery, [name]);
    // console.log("Matched Products:", matched);
    if (matched.length > 0) {
      const existingQRCode = matched[0].qr_code;
      const finalQRCode =
        existingQRCode && existingQRCode.trim() !== ""
          ? existingQRCode
          : qr_Path;
      // console.log("Matching product found:", matched[0].id , matched[0].product_quantity);
      const updateQuery = `
        UPDATE qr_products
        SET product_price = ?, product_quantity = ?, product_name = ?, qr_code = ?
        WHERE id = ?
      `;
      const updateParams = [
        price,
        parseInt(matched[0].product_quantity) + parseInt(quantity),
        name,
        finalQRCode,
        matched[0].id,
      ];
      await post_database(updateQuery, updateParams);

      return res
        .status(200)
        .json({ message: "Matching product updated successfully" });
    } else {
      const insertQuery = `
        INSERT INTO qr_products 
        (product_code, product_name, product_price, product_quantity, qr_code)
        VALUES (?, ?, ?, ?, ?)
      `;
      const insertParams = [product_id, name, price, quantity, qr_Path];
      await post_database(insertQuery, insertParams);

      return res
        .status(200)
        .json({ message: "New product inserted successfully" });
    }
  } catch (error) {
    console.error("Error processing QR product:", error);
    res.status(500).json({ error: "Failed to process QR product" });
  }
};

exports.get_qr_products = async (req, res) => {
  try {
    const { term } = req.query;
    let query = `
        SELECT id, product_code AS code , product_name AS name, product_price AS price,  product_quantity, qr_code 
        FROM qr_products 
        WHERE status = ?
      `;
    const params = ["1"];

    if (term) {
      query += `
          AND (
            LOWER(product_name) LIKE LOWER(?) 
            OR LOWER(product_code) LIKE LOWER(?)
          )
        `;
      const likeTerm = `%${term.toLowerCase()}%`;
      params.push(likeTerm, likeTerm);
    }

    const result = await get_database(query, params);
    res.status(200).json(result);
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

// jo
exports.get_product_by_code = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Product code is required" });
    }

    const query = `
      SELECT 
        product_code AS code, 
        product_name AS name, 
        product_price AS price 
      FROM qr_products 
      WHERE product_code = ? AND status = '1'
      LIMIT 1
    `;
    const params = [code];
    const result = await get_database(query, params);

    if (result.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching product by code:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};
