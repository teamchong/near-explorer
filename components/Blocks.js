import Link from "next/link";

import { Container, Row, Col } from "react-bootstrap";

import Content from "./Content";

const Blocks = () => (
  <Content title="Blocks" count="123456">
    <Row>
      <Col>Hello</Col>
    </Row>
  </Content>
);

export default Blocks;
