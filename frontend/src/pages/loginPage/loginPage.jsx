import React, { useState, useEffect } from "react";
import "./loginPage.css";
import { useNavigate } from "react-router-dom";
import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { Input, Button, Form } from "antd";
import { showSuccess, showError } from "../../components/toast/toast";
import CustomizedSwitches from "../../components/appLayout/theme/toggleTheme";
import image from "../../assets/image.png";
import requestApi from "../../components/utils/axios";
import hunnybunny from "../../assets/hunnybunny.png";

function Login() {
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.removeItem("D!");
  }, []);
  const onFinish = async (values) => {
    setLoading(true);
    const { username, password } = values;

    const response = await requestApi("POST", "/auth/login", {
      username,
      password,
    });

    if (response.success) {
      showSuccess("Login successful");
      localStorage.setItem("D!", response.data.token);
      navigate("/dashboard");
    } else {
      showError("Invalid credentials!");
      message.error(response.error?.message || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <p>
        <CustomizedSwitches />
      </p>
      <div className="overlay"></div>
      <div className="login-card">
        <div className="card-image-section">
          <img src={image} alt="Bakery inside" className="card-image" />
        </div>
        <div className="card-form-section">
          <center>
            <img className="hunnybunny" src={hunnybunny} alt="" />
            <p>Freshness at your fingertips!</p>
          </center>
          <Form
            name="login-form"
            onFinish={onFinish}
            // className="login-form"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: "Please input your username!" },
              ]}
            >
              <Input placeholder="Username" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: "Please input your password!" },
              ]}
            >
              <Input.Password
                placeholder="Password"
                visibilityToggle={{
                  visible: passwordVisible,
                  onVisibleChange: setPasswordVisible,
                }}
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-btn"
              >
                Login
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default Login;
