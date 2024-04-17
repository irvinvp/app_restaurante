const express = require("express");
const cors = require("cors");
const app = express();
const fs = require("fs");
const crypto = require("crypto");
const password = process.env.PASSWORD || "dsdasda8s9d8a0sd9as8d9as8d90as92";

// Cirpter
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", password, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return {
    iv: iv.toString("hex"),
    data: encrypted,
  };
}
function decrypt(encryptedData) {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    password,
    Buffer.from(encryptedData.iv, "hex")
  );
  let decrypted = decipher.update(encryptedData.data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

app.set("json spaces", 2);
app.use(cors());
app.options("*", cors());

// web pages for CDN
app.get("/", (req, res) => {
  res.send(fs.readFileSync("./index.html", "utf8"));
});
app.get("/c", (req, res) => {
  res.send(fs.readFileSync("./code.html", "utf8"));
});
app.get("/nuevo-usuario.html", (req, res) => {
  res.send(fs.readFileSync("./nuevo-usuario.html", "utf8"));
});
app.get("/home", (req, res) => {
  res.send(fs.readFileSync("./home.html", "utf8"));
});

// Services
app.get("/get-code", (req, res) => {
  let code = {
    code: Buffer.from(crypto.randomBytes(4)).toString("hex"),
    date: new Date().toISOString(),
  };
  let r = encrypt(JSON.stringify(code));
  res.send(r.iv + r.data);
});
app.get("/resgister/:email", (req, res) => {
  // TODO: Evaluate if email is already registered on redis
  let code = {
    code: Buffer.from(crypto.randomBytes(4)).toString("hex"),
    date: new Date().toISOString(),
    email: req.params.email,
  };
  let r = encrypt(JSON.stringify(code));
  res.send(r.iv + r.data);
});
let codes = {};
let master_session = {}; // TODO pasar a redis
app.get("/cs/:c/:cc", (req, res) => {
  // c code
  let code = decrypt({
    iv: req.params.c.substring(0, 32),
    data: req.params.c.substring(32),
  });
  try {
    code = JSON.parse(code);
  } catch (e) {
    res.status(400);
    code = { error: "Error al decifrar" };
  }
  // cc code
  let code_cc = { code: "" };
  if (req.params.cc != "NA") {
    try {
      let code = decrypt({
        iv: req.params.cc.substring(0, 32),
        data: req.params.cc.substring(32),
      });
      code_cc = JSON.parse(code);
    } catch (e) {}
  }
  if (
    codes[code.code] &&
    (code.email || master_session[code_cc.email] == code_cc.code)
  ) {
    try {
      let code_session = {
        code: code.code,
        date: new Date(Date.now() + 120000).getTime(),
        type: "pcc",
      };
      let r = encrypt(JSON.stringify(code_session));
      codes[code.code].res.json({ code: r.iv + r.data });
      // Create Token
      let code_token = {
        code: Buffer.from(crypto.randomBytes(4)).toString("hex"),
        type: "cc",
        email: code.email,
      };
      // TODO save token in redis
      master_session[code_token.email] = code_token.code;
      let token = encrypt(JSON.stringify(code_token));
      res.json({ code: token.iv + token.data });
    } catch (e) {}
    try {
      clearTimeout(codes[code.code].end);
    } catch (e) {}
    delete codes[code.code];
  } else {
    res.status(400);
    res.json({ error: "Invalid code" });
  }
});
// Auth for PC
app.get("/auth/:c", (req, res) => {
  let code = decrypt({
    iv: req.params.c.substring(0, 32),
    data: req.params.c.substring(32),
  });
  try {
    code = JSON.parse(code);
  } catch (e) {
    res.status(400);
    code = { error: "Error al decifrar" };
  }
  let end = setTimeout(() => {
    res.status(400);
    res.json({ error: "Timeout" });
    delete codes[code.code];
  }, 60000);
  codes[code.code] = { res: res, end: end };
});
app.get("/auth_check/:c", (req, res) => {
  let code = decrypt({
    iv: req.params.c.substring(0, 32),
    data: req.params.c.substring(32),
  });
  try {
    code = JSON.parse(code);
  } catch (e) {
    res.status(400);
    code = { error: "Error al decifrar" };
  }
  // PCC
  if (code.type == "pcc") {
    if (code.date < new Date().getTime()) {
      res.status(400);
      res.json({ error: "Expired" });
    } else {
      res.json({
        ok: true,
        type: "pcc",
        date: code.date - new Date().getTime(),
      });
    }
  }
});
app.listen(4000, () => {
  console.log("En línea");
});
// TODO
/*
- leer codigo en home y en index para enviar directo a la cuenta OK
- Guardar token larga duracion en celular OK
- guardar datos en redis cuando se registra un usuario nuevo
*/
