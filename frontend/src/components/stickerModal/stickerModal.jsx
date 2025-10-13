import React, { useRef, useState } from "react";
import { Modal, Button, Select } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import apiHost from "../../components/utils/api";

const StickerModal = ({
  visible,
  product,
  onClose,
  stickerCount,
  setStickerCount,
  editStates,
}) => {
  const previewRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const generatePDFPreview = async () => {
    const input = previewRef.current;
    if (!input) return;

    setLoading(true);

    const inchToPx = 96;
    let stickerWidth = 2 * inchToPx; // 192px
    let stickerHeight = 1 * inchToPx; // 96px
    const gap = 24; // 0.25 inch
    const rowMargin = 12;

    const stickersPerRow = 2;
    const totalRows = Math.ceil(stickerCount / stickersPerRow);

    let pageWidth = gap + stickersPerRow * stickerWidth + (stickersPerRow - 1) * gap + gap;
    let pageHeight = gap + totalRows * stickerHeight + (totalRows - 1) * gap + (totalRows - 1) * rowMargin + gap;

    // If exactly 4 stickers, dynamically size stickers to fit the page
    if (stickerCount === 4) {
      // Define a target page size (A4 or similar, or keep the same logic as before)
      // Let's use a smaller custom page size for 4 stickers
      pageWidth = gap + stickersPerRow * stickerWidth + (stickersPerRow - 1) * gap + gap; // px, can be adjusted
      pageHeight = gap + totalRows * stickerHeight + (totalRows - 1) * gap + (totalRows - 1) * rowMargin + gap; // px, can be adjusted
      // stickerWidth = (pageWidth - gap * 3) / 4; 
      // stickerHeight = (pageHeight - gap * 3) / 4; 

      stickerWidth = 1.08 * inchToPx; // 192px
    stickerHeight =  inchToPx /2.3; // 96px
    }

    const pdf = new jsPDF({
      unit: "px",
      format: [pageWidth, pageHeight],
    });

    const hiddenContainer = document.createElement("div");
    hiddenContainer.style.position = "absolute";
    hiddenContainer.style.top = "-9999px";
    hiddenContainer.style.left = "0";
    hiddenContainer.style.zIndex = "-1";
    document.body.appendChild(hiddenContainer);

    for (let i = 0; i < stickerCount; i++) {
      const clone = input.cloneNode(true);
      clone.style.margin = 0;
      clone.style.padding = 0;
      clone.style.width = `${stickerWidth}px`;
      clone.style.height = `${stickerHeight}px`;
      clone.style.boxSizing = "border-box";
      clone.style.background = "#fff";

      hiddenContainer.appendChild(clone);
      await new Promise((res) => setTimeout(res, 30));

      const canvas = await html2canvas(clone, {
        useCORS: true,
        scale: 3,
      });

      const imgData = canvas.toDataURL("image/png");

      const row = Math.floor(i / stickersPerRow);
      const col = i % stickersPerRow;

      const x = gap + col * (stickerWidth + gap);
      const y = gap + 13 + row * (stickerHeight + gap + rowMargin);

      pdf.addImage(imgData, "PNG", x, y, stickerWidth, stickerHeight);
      hiddenContainer.removeChild(clone);
    }

    document.body.removeChild(hiddenContainer);
    pdf.save(`${product.code}_stickers.pdf`);
    setLoading(false);
  };

  return (
    <Modal
      title="Print Sticker"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      {product && (
        <>
          <div
            ref={previewRef}
            style={{
              width: 192,
              height: 96,
              padding: 10,
              textAlign: "center",
              margin: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
            }}
          >
            <div className="flex flex-row gap-2 justify-center items-center">
              <div className="flex-1 flex-col items-center justify-center gap-2">
                <img
                  crossOrigin="anonymous"
                  src={`${apiHost}/public/${product.qr_code}`}
                  alt="QR"
                  style={{ width: stickerCount === 4 ? 35 : 50, height: stickerCount === 4 ? 30 : 50 }}
                />
                <p style={{ fontWeight: "bold", fontSize: (stickerCount === 4 ? "5px" : "10px") }}>
                  {product.code}
                </p>
              </div>
              <div>
                <p style={{ fontWeight: "bold", fontSize: (stickerCount === 4 ? "5px" : "10px") }}>
                  Hunny Bunny
                </p>
                <h4 style={{ fontWeight: "bold", fontSize: (stickerCount === 4 ? "5px" : "10px") }}>
                  {product.name.toUpperCase()}
                </h4>
                <div className="flex flex-row-reverse gap-4 mt-1">
                  <div className="flex-1 flex-col">
                    <p style={{ fontWeight: "600", fontSize: (stickerCount === 4 ? "5px" : "9px") }}>
                      MRP {product.price}
                    </p>
                    <p style={{ fontSize: (stickerCount === 4 ? "5px" : "8px") }}>
                      {product.product_quantity} {editStates[product.id]?.qty}
                    </p>
                  </div>
                  <div className="flex flex-col align-middle">
                    <p style={{ fontWeight: "400", fontSize: (stickerCount === 4 ? "4px" : "8px") }}>
                      pkd:{" "}
                      {editStates[product.id]?.pkd
                        ? dayjs(editStates[product.id].pkd, "DD-MM-YYYY").format(
                            "DD-MM-YYYY"
                          )
                        : "--"}
                    </p>
                    <p style={{ fontWeight: "400", fontSize: (stickerCount === 4 ? "4px" : "8px") }}>
                      exp:{" "}
                      {editStates[product.id]?.exp
                        ? dayjs(editStates[product.id].exp, "DD-MM-YYYY").format(
                            "DD-MM-YYYY"
                          )
                        : "--"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Select
            value={stickerCount}
            onChange={setStickerCount}
            style={{ marginTop: 16, width: "100%" }}
            options={Array.from({ length: 10 }, (_, i) => {
              const value = (i + 1) * 4;
              return { value, label: value };
            })}
            placeholder="Select number of stickers"
          />

          <Button
            icon={<PrinterOutlined />}
            type="primary"
            onClick={generatePDFPreview}
            loading={loading}
            disabled={loading}
            style={{ marginTop: 16, width: "100%" }}
          >
            {loading ? "Generating..." : "Print Preview"}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default StickerModal;
