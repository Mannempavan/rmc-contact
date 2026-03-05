require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

/* ========== TWILIO SETUP =========== */
const client = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH
);

/* ========= PHONE FORMAT FUNCTION ========= */
function formatPhone(number) {
    number = number.replace(/\D/g, "");

    if (number.startsWith("0")) {
        number = number.substring(1);
    }

    if (!number.startsWith("91")) {
        number = "91" + number;
    }

    return "+" + number;
}

/* ============== EMAIL SETUP ============== */
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/* ====== FORM HANDLER ======== */
app.post("/send-enquiry", async (req, res) => {
    console.log("FORM HIT");

    const { name, phone, email, address, message } = req.body;
    /* ===== BACKEND VALIDATION ===== */

    if (!name || name.length < 3 || name.length > 30) {
        return res.status(400).send("Invalid name");
    }

    if (!email || email.length > 100) {
        return res.status(400).send("Invalid email length");
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).send("Invalid email format");
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
        return res.status(400).send("Invalid phone number");
    }

    if (!phone || !/^[0-9]{10}$/.test(phone)) {
        return res.status(400).send("Enter valid 10 digit number");
    }

    if (!address || address.length > 150) {
        return res.status(400).send("Address too long");
    }

    if (!message || message.length > 500) {
        return res.status(400).send("Message too long");
    }

    /* ===== FORMAT PHONE AFTER VALIDATION ===== */
    const formattedCustomerPhone = formatPhone(phone);
    try {

        /* ================= ADMIN EMAIL ================= */
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: "🚨 New RMC Enquiry",
            text:
                `New enquiry received:

Name: ${name}
Phone: ${phone}
Email: ${email}
Address: ${address}
Message: ${message}`
        });

        console.log("Admin email sent");

        /* ================= CUSTOMER EMAIL ================= */
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "We received your enquiry - MSM RMC",
            text:
                `Hi ${name},

Thank you for contacting MSM RMC.

We have received your enquiry and our team will contact you shortly.

Regards,
MSM RMC Team`
        });

        console.log("Customer email sent");

        // Send response immediately
        res.sendFile(__dirname + "/public/thankyou.html");

        /* ================= ADMIN SMS ================= */
        try {
            await client.messages.create({
                body: `New enquiry from ${name} - ${phone} - ${email} - ${address} - ${message}`,
                from: process.env.TWILIO_PHONE,
                to: process.env.YOUR_PHONE,
            });
            console.log("Admin SMS sent");
        } catch (err) {
            console.log("Admin SMS error:", err.message);
        }

        /* ================= CUSTOMER SMS ================= */
        try {
            await client.messages.create({
                body:
                    `Hi ${name},

Thank you for contacting MSM RMC.
Our team will reach out shortly.`,
                from: process.env.TWILIO_PHONE,
                to: formattedCustomerPhone,
            });
            console.log("Customer SMS sent");
        } catch (err) {
            console.log("Customer SMS error:", err.message);
        }

        /* ================= ADMIN WHATSAPP ================= */
        try {
            await client.messages.create({
                from: process.env.TWILIO_WHATSAPP,
                to: process.env.ADMIN_WHATSAPP,
                body:
                    `🚨 New RMC Enquiry

👤 Name: ${name}
📞 Phone: ${phone}
📧 Email: ${email}
📍 Address: ${address}
📝 Message: ${message}`
            });
            console.log("Admin WhatsApp sent");
        } catch (err) {
            console.log("Admin WhatsApp error:", err.message);
        }

        /* ================= CUSTOMER WHATSAPP ================= */
        try {
            await client.messages.create({
                from: process.env.TWILIO_WHATSAPP,
                to: "whatsapp:" + formattedCustomerPhone,
                body:
                    `Hi ${name} 👋

Thank you for contacting MSM RMC.

We have received your enquiry and will contact you shortly.

Regards,
MSM RMC Team`
            });
            console.log("Customer WhatsApp sent");
        } catch (err) {
            console.log("Customer WhatsApp error:", err.message);
        }

    } catch (error) {
        console.log("Main error:", error.message);
        res.status(500).send("Error sending enquiry");
    }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});