import React, { useState, useRef, useCallback, useEffect } from "react";
// import QRWebcam from "./QRWebcam";
import { Button } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import ProductTable from "./ProductTable";
import CustomerForm from "./CustomerForm";
import PDFPreviewModal from "./PDFPreviewModal";
import generatePDF from "../../components/utils/pdfGenerator";
import axios from "axios";
import apiHost from "../../components/utils/api";
import "./QRScanner.css";
import {
  showSuccess,
  showError,
  showWarning,
} from "../../components/toast/toast";
import requestApi from "../../components/utils/axios";
import { jwtDecode } from "jwt-decode";

const QRScanner = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const scannedCodes = useRef(new Set());

  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [userLocation, setUserLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [externalScannerBuffer, setExternalScannerBuffer] = useState("");
  const [isExternalScannerActive, setIsExternalScannerActive] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("D!");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserLocation(decoded?.location || "");
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(
        imageData.data,
        imageData.width,
        imageData.height
      );

      if (code && !scannedCodes.current.has(code.data)) {
        scannedCodes.current.add(code.data);
        fetchProduct(code.data);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(capture, 1000);
    return () => clearInterval(interval);
  }, [capture]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleSaveBillOnly();
      } else if (e.key === "F6") {
        e.preventDefault();
        handleSaveBill();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, customerName, paymentMethod]);

  const fetchProduct = async (code) => {
    try {
      const res = await axios.get(
        `${apiHost}/products/qr_products?term=${code}`
      );
      const prod = res.data.data?.[0];
      if (!prod) throw new Error("Product not found");

      const price = parseFloat(prod.price);
      const newProduct = { ...prod, price, quantity: 1 };

      setProducts((prev) => {
        const exists = prev.some((p) => p.code === newProduct.code);
        if (exists) return prev;
        return [...prev, newProduct];
      });
    } catch {
      alert("Product not found or error.");
    }
  };

  const recalculateTotal = (updated) => {
    console.log(updated);
    const total = updated.reduce((sum, p) => sum + p.price * p.quantity, 0);
    setTotalAmount(total);
    console.log("total", total);
  };

  const handleChange = (index, field, value) => {
    setProducts((prev) => {
      let updated = [...prev];
      if (field === "delete") {
        updated.splice(index, 1);
      } else {
        if (!updated[index]) {
          updated[index] = { code: "", name: "", price: 0, quantity: 1 };
        }
        if (["price", "quantity"].includes(field)) {
          updated[index][field] = parseFloat(value) || 0;
        } else {
          updated[index][field] = value;
        }
      }

      setTimeout(() => recalculateTotal(updated), 0);
      return updated;
    });
  };
  useEffect(() => {
    recalculateTotal(products);
  }, [products]);

  const handleClearAll = () => {
    scannedCodes.current.clear();
    setProducts([]);
    setTotalAmount(0);
    setCustomerName("");
    setPaymentMethod("UPI");
  };

  const handleProductSelect = (product) => {
    const exists = products.some((p) => p.code === product.code);
    if (!exists) {
      const newProduct = {
        code: product.code,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
      };
      const updated = [...products, newProduct];
      setProducts(updated);
      recalculateTotal(updated);
    }
  };

  const buildPayload = (customerName) => ({
    customer_name: customerName,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    location: userLocation,
    items: products
      .filter((p) => p.code && p.name) // Only include filled rows
      .map((p) => ({
        product_name: p.name,
        quantity: p.quantity,
        unit_price: p.price,
      })),
  });

  const handleSaveBillOnly = async () => {
    // If customerName is empty or only whitespace, use '--'
    const finalCustomerName = customerName.trim() ? customerName : "--";
    if (products.length === 0) return showWarning("Scan Atleast 1 Product");

    setIsSaving(true);
    try {
      await requestApi(
        "POST",
        `/bills/bill-details`,
        buildPayload(finalCustomerName)
      );
      showSuccess("Bill saved successfully");
      handleClearAll();
    } catch {
      showError("Failed to save bill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBill = async () => {
    // If customerName is empty or only whitespace, use '--'
    const finalCustomerName = customerName.trim() ? customerName : "--";
    if (products.length === 0) return showWarning("Scan Atleast 1 products");

    setIsGenerating(true);
    try {
      await requestApi(
        "POST",
        `/bills/bill-details`,
        buildPayload(finalCustomerName)
      );
      showSuccess("Bill saved successfully!");
      handlePreviewBill();
    } catch {
      showError("Failed to save bill.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewBill = () => {
    const doc = generatePDF(products, totalAmount, customerName);
    const dataUri = doc.output("datauristring");
    setPdfUrl(dataUri);
    setShowPreview(true);
    handleClearAll();
  };

  useEffect(() => {
    let inputBuffer = "";
    let isTypingInInput = false;

    const handleKeyPress = (e) => {
      // Check if user is typing in an input field
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.contentEditable === "true"
      ) {
        isTypingInInput = true;
        return; // Don't capture input when typing in form fields
      }

      // Reset typing flag when not in input
      isTypingInInput = false;

      if (e.key === "Enter") {
        const code = inputBuffer.trim();
        inputBuffer = "";
        setExternalScannerBuffer(""); // Clear visual buffer
        setIsExternalScannerActive(false); // Hide indicator
        if (code && !scannedCodes.current.has(code)) {
          scannedCodes.current.add(code);
          fetchProduct(code);
          showSuccess(`Scanned: ${code}`);
        }
      } else if (e.key.length === 1 && !isTypingInInput) {
        inputBuffer += e.key;
        setExternalScannerBuffer(inputBuffer); // Update visual buffer
        setIsExternalScannerActive(true);

        // Auto-hide indicator after 3 seconds of inactivity
        setTimeout(() => {
          setIsExternalScannerActive(false);
          setExternalScannerBuffer("");
        }, 3000);
      }
    };

    const handleKeyDown = (e) => {
      // Handle ESC key to clear buffer
      if (e.key === "Escape") {
        inputBuffer = "";
        setExternalScannerBuffer("");
        setIsExternalScannerActive(false);
        showWarning("Scanner buffer cleared.");
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="qr-container">
      {/* <QRWebcam onScanProduct={fetchProduct} /> */}

      <div className="qr-reader-table">
        <CustomerForm
          customerName={customerName}
          setCustomerName={setCustomerName}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
        />
        <ProductTable
          products={products}
          handleChange={handleChange}
          totalAmount={totalAmount}
          handleClearAll={handleClearAll}
          handleSaveBill={handleSaveBill}
          handleProductSelect={handleProductSelect}
          isExternalScannerActive={isExternalScannerActive}
          externalScannerBuffer={externalScannerBuffer}
        />
        <div className="flex justify-end gap-2 bill-container">
          {/* <Button
            style={{
              backgroundColor: "#9b59b6",
              color: "white",
              border: "none",
            }}
            type="default"
            onClick={() => {
              const testBarcode = "8901063012813"; 
              if (!scannedCodes.current.has(testBarcode)) {
                scannedCodes.current.add(testBarcode);
                fetchProduct(testBarcode);
                showSuccess(`Test barcode scanned: ${testBarcode}`);
              }
            }}
          >
            Test Barcode
          </Button> */}

          <Button
            danger
            type="primary"
            onClick={handleClearAll}
            disabled={isSaving || isGenerating}
          >
            Clear All
          </Button>

          <Button
            type="default"
            onClick={handleSaveBillOnly}
            loading={isSaving ? { icon: <SyncOutlined spin /> } : false}
            disabled={isGenerating}
          >
            Save
          </Button>

          <Button
            type="primary"
            onClick={handleSaveBill}
            loading={isGenerating ? { icon: <SyncOutlined spin /> } : false}
            disabled={isSaving}
          >
            Save & Generate Bill
          </Button>
        </div>
      </div>

      {showPreview && (
        <PDFPreviewModal
          pdfUrl={pdfUrl}
          onClose={() => setShowPreview(false)}
          onDownload={() => {
            const doc = generatePDF(products, totalAmount, customerName);
            doc.save("Product_Bill.pdf");
            setShowPreview(false);
          }}
        />
      )}
    </div>
  );
};

export default QRScanner;
