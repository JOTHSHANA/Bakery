import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  Select,
  Spin,
  Modal,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import requestApi from "../../components/utils/axios";
import { debounce } from "lodash";
import { jwtDecode } from "jwt-decode";
import CustomCreatableSelect from "../../components/select/CreateSelect";

const { Option } = Select;

const ProductTable = ({
  products,
  handleChange,
  totalAmount,
  handleProductSelect,
  isExternalScannerActive,
  externalScannerBuffer,
  clearExternalScannerBuffer,
  setActiveField,
  handleBufferInput,
}) => {
  const [dataSource, setDataSource] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState({});
  const codeRefs = useRef([]);
  const nameRefs = useRef([]);
  const qtyRefs = useRef([]);
  const priceRefs = useRef([]);

  useEffect(() => {
    let updated = products.length > 0 ? [...products] : [];
    if (
      updated.length === 0 ||
      updated[updated.length - 1].code ||
      updated[updated.length - 1].name
    ) {
      updated.push({ code: "", name: "", price: 0, quantity: 1 });
    }
    setDataSource(updated);
  }, [products]);

  const fetchProducts = async (term = "") => {
    if (!term.trim()) {
      setProductList([]);
      return;
    }
    try {
      setLoading(true);
      const res = await requestApi(
        "GET",
        `/products/qr_products?term=${encodeURIComponent(term)}`
      );
      const list = res.data?.data || [];
      setProductList(list);
    } catch (err) {
      console.error("Error fetching products:", err);
      setProductList([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useRef(
    debounce((value) => {
      fetchProducts(value);
    }, 300)
  ).current;

  const handleSearch = (value) => {
    debouncedFetch(value);
  };

  const handleAddRow = () => {
    setDataSource((prev) => [
      ...prev,
      { code: "", name: "", price: 0, quantity: 1 },
    ]);
  };

  const handleDeleteRow = (index) => {
    const newData = [...dataSource];
    newData.splice(index, 1);
    setDataSource(newData);
    handleChange(index, "delete", null);
  };

  const onFieldChange = (index, field, value) => {
    const updated = [...dataSource];
    updated[index][field] =
      field === "price" || field === "quantity" ? Number(value) : value;
    if (
      updated.length > 0 &&
      updated[updated.length - 1].code &&
      updated[updated.length - 1].name
    ) {
      updated.push({ code: "", name: "", price: 0, quantity: 1 });
    }
    setDataSource(updated);
    handleChange(index, field, value);

    // Buffer update for quantity and price
    if (["quantity", "price"].includes(field)) {
      handleBufferInput(value?.toString() || "");
    }
    if (["code", "name"].includes(field)) {
      const productFieldList = productList.map((p) => p[field]);
      setInputMode((prev) => ({
        ...prev,
        [`${field}-${index}`]: !productFieldList.includes(value),
      }));
    }
  };

  const handleProductSelectDropdown = (code) => {
    const selected = productList.find((p) => p.code === code);
    if (selected) {
      handleProductSelect({
        code: selected.code,
        name: selected.name,
        price: parseFloat(selected.price),
        quantity: 1,
      });
      setDataSource((prev) => {
        const updated = [...prev];
        if (updated.length === 0 || updated[updated.length - 1].code) {
          updated.push({ code: "", name: "", price: 0, quantity: 1 });
        }
        return updated;
      });
      if (clearExternalScannerBuffer) clearExternalScannerBuffer();
    }
  };

  const handleTableKeyDown = (e, rowIndex, field) => {
    if (field === "name" || field === "code") {
      // For Name/Code fields, jump to Qty on ArrowRight
      // (Enter is handled natively by the select component's onChange)
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        if (qtyRefs.current[rowIndex]) {
          qtyRefs.current[rowIndex].focus();
          // Select the text inside the input so typing overwrites it
          setTimeout(() => {
            if (qtyRefs.current[rowIndex]?.select) {
              qtyRefs.current[rowIndex].select();
            }
          }, 10);
        }
      }
    } else if (field === "qty") {
      // For Qty, jump to next row's Name on ArrowRight OR Enter
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const nextRowIndex = rowIndex + 1;
        if (nameRefs.current[nextRowIndex]) {
          nameRefs.current[nextRowIndex].focus();
        }
      }
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text, record, index) => (
        <CustomCreatableSelect
          className="min-w-[180px]"
          placeholder="name"
          ref={(el) => (nameRefs.current[index] = el)}
          value={text ? { label: text, value: text } : null}
          onInputChange={(inputValue) => {
            if (inputValue) fetchProducts(inputValue);
          }}
          onChange={(option) => {
            const value = option?.value || "";
            const product = productList.find((p) => p.name === value);

            const updated = [...dataSource];
            if (product) {
              updated[index] = {
                code: product.code,
                name: product.name,
                price: parseFloat(product.price),
                quantity: 1,
              };
            } else {
              updated[index].name = value;
            }
            setDataSource(updated);
            handleChange(index, "name", value);
            if (product) {
              handleChange(index, "code", product.code);
              handleChange(index, "price", parseFloat(product.price));
              handleChange(index, "quantity", 1);
            }
            if (clearExternalScannerBuffer) clearExternalScannerBuffer();

            // Move cursor directly to QTY and highlight the text
            setTimeout(() => {
              if (qtyRefs.current[index]) {
                qtyRefs.current[index].focus();
                if (qtyRefs.current[index].select) {
                  qtyRefs.current[index].select();
                }
              }
            }, 50);
          }}
          onBlur={() => {
            if (clearExternalScannerBuffer) clearExternalScannerBuffer();
          }}
          options={productList.map((p) => ({
            label: `${p.name} (${p.code})`,
            value: p.name,
          }))}
          onKeyDown={(e) => handleTableKeyDown(e, index, "name")}
          data-row={index}
          data-field="name"
        />
      ),
    },
    {
      title: "Code",
      dataIndex: "code",
      render: (text, record, index) => (
        <CustomCreatableSelect
          className="min-w-[140px]"
          placeholder="code"
          ref={(el) => (codeRefs.current[index] = el)}
          value={text ? { label: text, value: text } : null}
          onInputChange={(inputValue) => {
            if (inputValue) fetchProducts(inputValue);
          }}
          onChange={(option) => {
            const value = option?.value || "";
            const product = productList.find((p) => p.code === value);

            const updated = [...dataSource];
            if (product) {
              updated[index] = {
                code: product.code,
                name: product.name,
                price: parseFloat(product.price),
                quantity: 1,
              };
            } else {
              updated[index].code = value;
            }
            setDataSource(updated);
            handleChange(index, "code", value);
            if (product) {
              handleChange(index, "name", product.name);
              handleChange(index, "price", parseFloat(product.price));
              handleChange(index, "quantity", 1);
            }
            if (clearExternalScannerBuffer) clearExternalScannerBuffer();

            // Move cursor directly to QTY and highlight the text
            setTimeout(() => {
              if (qtyRefs.current[index]) {
                qtyRefs.current[index].focus();
                if (qtyRefs.current[index].select) {
                  qtyRefs.current[index].select();
                }
              }
            }, 50);
          }}
          onBlur={() => {
            if (clearExternalScannerBuffer) clearExternalScannerBuffer();
          }}
          options={productList.map((p) => ({
            label: `${p.code} - ${p.name}`,
            value: p.code,
          }))}
          onKeyDown={(e) => handleTableKeyDown(e, index, "code")}
          data-row={index}
          data-field="code"
        />
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      render: (text, record, index) => (
        <Input
          ref={(el) => (qtyRefs.current[index] = el)}
          type="number"
          min={1}
          value={text}
          onChange={(e) => onFieldChange(index, "quantity", e.target.value)}
          placeholder="Qty"
          onKeyDown={(e) => handleTableKeyDown(e, index, "qty")}
          data-row={index}
          data-field="qty"
        />
      ),
    },
    {
      title: "Price",
      dataIndex: "price",
      render: (text, record, index) => (
        <Input
          ref={(el) => (priceRefs.current[index] = el)}
          type="number"
          min={0}
          step="0.01"
          value={text}
          onChange={(e) => onFieldChange(index, "price", e.target.value)}
          placeholder="Price"
          onKeyDown={(e) => handleTableKeyDown(e, index, "price")}
          data-row={index}
          data-field="price"
        />
      ),
    },
    {
      title: "Subtotal",
      key: "subtotal",
      render: (_, record) => (
        <>₹ {(record.price * record.quantity).toFixed(2)}</>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, __, index) => (
        <Popconfirm
          title="Delete this product?"
          description="Are you sure you want to delete this product?"
          okText="Yes"
          cancelText="No"
          onConfirm={() => handleDeleteRow(index)}
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="bill-container">
      {isExternalScannerActive && externalScannerBuffer && (
        <div className="mb-4 bg-green-100 text-green-800 px-4 py-3 rounded-lg shadow-sm border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <div className="font-semibold text-sm">
                  External Scanner Active
                </div>
                <div className="text-xs opacity-90">
                  Scanning barcode... Press ESC to clear
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-75 mb-1">Buffer</div>
              <div className="font-mono text-base font-bold bg-white bg-opacity-60 px-2 py-1 rounded border border-green-200">
                {externalScannerBuffer}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="qr-subtitle">Scanned Products</h3>

        <Select
          showSearch
          allowClear
          placeholder="Search product..."
          style={{ width: 300 }}
          filterOption={false}
          onSearch={handleSearch}
          onSelect={handleProductSelectDropdown}
          notFoundContent={loading ? <Spin size="small" /> : "No product"}
          dropdownStyle={{ maxHeight: 200, overflow: "auto" }}
        >
          {productList.slice(0, 5).map((product) => (
            <Option key={product.code} value={product.code}>
              {product.name} ({product.code}) - ₹{product.price}
            </Option>
          ))}
        </Select>
      </div>

      <div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          rowKey={(record, index) => record.code + index}
          bordered
        />
      </div>

      <div className="qr-actions" style={{ marginTop: "1rem" }}>
        <Button icon={<PlusOutlined />} type="dashed" onClick={handleAddRow}>
          Add Row
        </Button>
      </div>

      <div className="qr-total">Total Amount: ₹{totalAmount.toFixed(2)}</div>
    </div>
  );
};

export default ProductTable;