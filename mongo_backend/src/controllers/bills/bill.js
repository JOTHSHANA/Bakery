const Bill = require("../../models/Bill");
const BillDetail = require("../../models/BillDetail");
// const { update_stock } = require("../../controllers/products/stocks");

exports.post_bill = async (req, res) => {
  try {
    const { customer_name, total_amount, payment_method, items, location } = req.body;

    if (
      !total_amount ||
      !payment_method ||
      !items ||
      !location ||
      items.length === 0
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Save Bill
    const newBill = new Bill({
      customer_name,
      total_amount,
      payment_method,
      location,
      status: '1'
    });

    const savedBill = await newBill.save();

    // Save Bill Details
    const detailDocs = items.map((item) => ({
      bill_id: savedBill._id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      location: location,
      status: '1',
      createdAt: new Date()
    }));

    await BillDetail.insertMany(detailDocs);

    // Update stock
    // for (const item of items) {
    //   const result = await update_stock(item.product_name, item.quantity);
    //   console.log(`Stock updated for ${item.product_name}:`, result);
    // }

    return res.status(200).json({ message: "Bill and items saved successfully" });
  } catch (error) {
    console.error("Error inserting bill:", error);
    return res.status(500).json({ error: "Failed to insert bill and items" });
  }
};

exports.get_bills = async (req, res) => {
  try {
    const { name, bill_id, location, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { status: '1' };

    if (name) {
      const num = parseInt(name);
      query.$or = [
        { customer_name: { $regex: name, $options: 'i' } },
        ...(isNaN(num) ? [] : [{ bill_number: num }])
      ];
    }

    if (bill_id) {
      query.bill_number = parseInt(bill_id) || 0;
    }

    if (location) {
      query.location = location;
    }

    const total = await Bill.countDocuments(query);
    const bills = await Bill.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    if (!bills.length) {
      return res.status(200).json({ data: [], total: 0 });
    }

    const billIds = bills.map(b => b._id);
    const details = await BillDetail.find({ bill_id: { $in: billIds } });

    const billMap = {};

    bills.forEach(bill => {
      billMap[bill._id] = {
        bill_id: bill._id,
        customer_name: bill.customer_name,
        total_amount: parseFloat(bill.total_amount.toString()),
        payment_method: bill.payment_method,
        bill_number: bill.bill_number,
        date: bill.createdAt,
        location: bill.location,
        items: []
      };
    });

    details.forEach(detail => {
      if (billMap[detail.bill_id]) {
        billMap[detail.bill_id].items.push({
          product_name: detail.product_name,
          quantity: detail.quantity,
          location: detail.location,
          unit_price: parseFloat(detail.unit_price.toString())
        });
      }
    });

    res.status(200).json({ data: Object.values(billMap), total });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
};
