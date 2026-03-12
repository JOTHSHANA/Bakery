import React, { useEffect, useState } from "react";
import { showError, showSuccess, showWarning } from "../../components/toast/toast";
import {
  Collapse,
  Table,
  Input,
  Typography,
  Pagination,
  Empty,
  Space,
  Button,
  Tooltip,
  Card,
} from "antd";
import { PrinterOutlined,DownloadOutlined } from "@ant-design/icons";
import { jwtDecode } from "jwt-decode";
import requestApi from "../../components/utils/axios";
import generateReceiptHTML from "../../components/utils/receiptHtml";
import dayjs from "dayjs";

const { Panel } = Collapse;

const History = () => {
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const billsPerPage = 5;
  const [location, setLocation] = useState("");
  const [totalBills, setTotalBills] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("D!");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLocation(decoded?.location || "");
      } catch (err) {
        console.error("Invalid token for decoding:", err);
      }
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!location) return;

    const fetchBills = async () => {
      try {
        let url = `/bills/bill-details?page=${currentPage}&limit=${billsPerPage}&location=${encodeURIComponent(location)}`;
        if (debouncedSearch) {
          url += `&name=${encodeURIComponent(debouncedSearch)}`;
        }

        const response = await requestApi("GET", url);
        setBills(response.data.data || []);
        setTotalBills(response.data.total || 0);
      } catch (error) {
        console.error("Error fetching bills:", error);
        setBills([]);
        setTotalBills(0);
      }
    };

    fetchBills();
  }, [debouncedSearch, location, currentPage]);

  const handlePrint = async (bill) => {
    try {
      const total = (bill.items || []).reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );

      const products = bill.items.map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
      }));

      const html = generateReceiptHTML(
        products,
        total,
        bill.customer_name || "--",
      );

      const result = await window.electronAPI.printHTML(html);

      if (result?.success) {
        tshowSuccess("Receipt printed");
      } else if (result?.saved) {
  showWarning("Printer not connected. Receipt saved locally.");
      }
    } catch (err) {
  showError("Printing failed");
    }
  };

  const handleSaveLocal = async (bill) => {
    try {
      const total = (bill.items || []).reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );

      const products = bill.items.map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.unit_price,
      }));

      const html = generateReceiptHTML(
        products,
        total,
        bill.customer_name || "--",
      );

      const result = await window.electronAPI.saveReceipt(html);

      if (result?.saved) {
  showSuccess("Receipt saved to Downloads");
      }
    } catch (err) {
  showError("Save failed");
    }
  };

  const renderItemsTable = (items = []) => {
    return (
      <Table
        dataSource={items.map((item, idx) => ({
          key: idx,
          name: item.product_name,
          qty: item.quantity,
          price: item.unit_price,
          subtotal: (item.unit_price * item.quantity).toFixed(2),
        }))}
        pagination={false}
        size="small"
        bordered
        columns={[
          {
            title: "Product Name",
            dataIndex: "name",
          },
          {
            title: "Quantity",
            dataIndex: "qty",
            align: "right",
          },
          {
            title: "Unit Price",
            dataIndex: "price",
            align: "right",
            render: (text) => `₹${text}`,
          },
          {
            title: "Subtotal",
            dataIndex: "subtotal",
            align: "right",
            render: (text) => `₹${text}`,
          },
        ]}
        style={{ marginTop: 10 }}
      />
    );
  };

  return (
    <Card style={{ backgroundColor: "var(--background-1)" }}>
      <Typography.Title level={4} style={{ color: "var(--text)" }}>
        Customer Bills
      </Typography.Title>

      <Input
        placeholder="Search by customer name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 300, marginBottom: 16 }}
      />

      {bills.length === 0 ? (
        <Empty description="No bills found" style={{ marginTop: 40 }} />
      ) : (
        <Collapse accordion style={{ backgroundColor: "var(--background-1)" }}>
          {bills.map((bill) => {
            const total = (bill.items || []).reduce(
              (sum, item) => sum + item.quantity * item.unit_price,
              0,
            );
            return (
              <Panel
                header={
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <Space direction="vertical">
                      <Typography.Text style={{ fontWeight: 600 }}>
                        Bill #{bill.bill_number} - {bill.customer_name}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Payment: {bill.payment_method} | Date:{" "}
                        {dayjs(bill.date).format("DD MMM YYYY, hh:mm A")}
                      </Typography.Text>
                      <Typography.Text strong>
                        Total: ₹{total.toFixed(2)}
                      </Typography.Text>
                    </Space>
                    <Space>
                    <Tooltip title="Print Receipt">
                      <Button
                        type="text"
                        icon={<PrinterOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(bill);
                        }}
                      />
                    </Tooltip>

                    <Tooltip title="Save Receipt">
                      <Button
                        type="text"
                        icon={<DownloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveLocal(bill);
                        }}
                      />
                    </Tooltip>
                    </Space>
                  </div>
                }
                key={bill.bill_id}
                style={{ backgroundColor: "var(--background-1)" }}
              >
                {renderItemsTable(bill.items)}
              </Panel>
            );
          })}
        </Collapse>
      )}

      {totalBills > billsPerPage && (
        <Pagination
          style={{ marginTop: 20, textAlign: "center" }}
          current={currentPage}
          total={totalBills}
          pageSize={billsPerPage}
          onChange={(page) => setCurrentPage(page)}
        />
      )}
    </Card>
  );
};

export default History;
