const express = require("express");
const mongoose = require("mongoose")
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer")
const multer = require("multer")
const cookieParser = require("cookie-parser");
const path = require("path");
const { read } = require("fs");
const port = 3001;
const passkey = "iBkDs"
const http = require("http");
const socketIo = require("socket.io");
const server = http.createServer(app);
const io = socketIo(server);
const { Server } = require('socket.io');

app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000",
    method: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "userId", "token"]
}));
app.use(cookieParser());
app.use(express.static(__dirname));


app.use("/uploads", express.static(path.join(__dirname, "uploads")))

io.on('connection', (socket) => {
    console.log('A user connected');

    // Listen for a "like" event
    socket.on('likePost', (data) => {
        console.log('Post liked:', data);

        // Broadcast the update to all connected clients
        io.emit('postLiked', data);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// DB Connect

mongoose.connect('mongodb://localhost:27017/users-data')
    .then(() => console.log('DB Connected!'))
    .catch((e) => console.log("Db connection :" + e))


// User SChEMAS

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    otp: String

})

const userpostsSchema = new mongoose.Schema({
    post: String,
    image: String,
    
    ID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    Postuser: String,
    likes: { type: Number, default: 0 },
    likedBy: { type: [String], default: []}

});

const Userpost = mongoose.model("UserPost", userpostsSchema);
const User = mongoose.model("User", userSchema);


//Nodemailer
const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: 'ibrarulhaq141@gmail.com',
        pass: 'uzmi vnhq bsjd eyhy',
    },
});

// generrate OTP
function generateotp(length = 5) {
    let otp = Math.floor((Math.random() * 1000) + 9999);
    return otp;
}



app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        let Exemail = await User.findOne({ email });
        if (Exemail) {
            res.status(400).json({
                msg: "Email already exists, Please Login"
            })
        }


        const otp = generateotp();


        const newUser = new User({
            username,
            email,
            password,
            otp: otp
        })
        await newUser.save();






        const mailOptions = {
            from: "ibrarulhaq141@gmail.com",
            to: email,
            subject: "Your OTP code",
            text: `Your OTP is ${otp}. Use it to verify yourself`
        }
        transport.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(400).json({
                    msg: "Otp not sent"
                })
            }
            return res.status(200).json({
                msg: "User Created Successfully, Check youremail to verify"
            })
        })
    }
    catch {
        res.status(500).json({
            msg: "Server error In creating user"
        })
    }
})

app.post("/verifyotp", async (req, res) => {
    const { otp } = req.body;

    try {
        let user = await User.findOne({ otp });
        if (user.otp == otp) {
            user.otp = null;
            await user.save();
            res.status(200).json({
                msg: "OTP verified Successfully"
            })
        }
        else {
            res.status(400).json({
                msg: "Invalid OTP"
            })
        }

    } catch (error) {
        res.status(500).json({
            msg: "OTP not found"
        })
    }

})


function authentication(req, res, next) {
    let token = req.headers.token;
    if (!token) {
        return res.status(400).json({
            msg: "Not logged in"
        })
    }
    try {

        const decoded = jwt.verify(token, passkey);
        req.user = decoded
        next();
    }
    catch (error) {
        return res.status(401).json({
            msg: "Invalid Token"
        })
    }
}





app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        let exUser = await User.findOne({ email });
        // console.log(exUser)
        if (!exUser || password != exUser.password) {
            res.status(401).json({
                msg: "Email or password not matched"
            })
        }

        let token = jwt.sign({ email, userId: exUser._id }, passkey);
        // res.cookie("token", token, {httpOnly:true})
        res.status(200).json({
            msg: " login successfully",
            token
        })


    } catch (error) {
        res.status(500).json({
            msg: "Error" + error
        })
    }
})

app.post("/getemailfp", async (req, res) => {
    const { email } = req.body;
    try {
        let exUser = await User.findOne({ email });
        if (!exUser) {
            return res.status(400).json({
                msg: "User Not Found"
            })
        }
        const otp = generateotp();
        exUser.otp = otp;
        await exUser.save();

        const mailOptions = {
            from: "ibrarulhaq141@gmail.com",
            to: email,
            subject: "To reset password",
            text: `Your Otp is ${otp}. Use it to verify yourself and reset your password`
        }

        transport.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(401).json({
                    msg: "Sent OTP failed"
                })
            }
            else {
                return res.status(200).json({
                    msg: "OTP sent successfully"
                })
            }
        })

    }
    catch (error) {
        res.status(500).json({
            msg: error
        })
    }
})




app.post("/forgetpasword", async (req, res) => {
    const { email, newpassword } = req.body;

    const exUser = await User.findOne({ email });


    try {
        if (exUser) {

            exUser.password = newpassword;
            await exUser.save();
            res.status(200).json({
                msg: "Password changed successfully"
            })
        }
        else {
            res.status(400).json({
                msg: "User not found"
            })
        }
    }
    catch (error) {
        res.status(500).json({
            msg: error
        })
    }


})


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "images/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage
})

app.post("/createpost", authentication, upload.single('image'), async (req, res) => {
    const { post } = req.body;
    const userId = req.user.userId;
    // const currentUser = await User.findOne({userId})

    try {
        const imagePath = req.file ? `images/${req.file.filename}` : null;

        const userpost = new Userpost({
            post,
            image: imagePath,
            ID: userId,
            likes: 0

        })
        await userpost.save();
        res.status(200).json({
            msg: "post created successfully"
        })
    }
    catch (error) {
        res.status(500).json({
            msg: error
        })
    }


})


app.get("/fetchallpost", authentication, async (req, res) => {
    const userId = req.headers.userid;



    try {
        const Allposts = await Userpost.find({
            ID: { $ne: userId }
        });

        res.status(200).json({
            msg: "all ppost",
            Allposts
        })
    }
    catch (error) {
        res.status(400).json({
            msg: "Error ibrar "
        })
    }
})
app.get("/fetchallpostprofile", authentication, async (req, res) => {
    const userId = req.headers.userid;
    console.log("profile ", userId)

    try {
        const Allposts = await Userpost.find({
            ID: { $eq: userId }
        });

        res.status(200).json({
            msg: "all ppost",
            Allposts
        })
    }
    catch (error) {
        res.status(400).json({
            msg: "Error ibrar "
        })
    }
})


app.delete("/deletepost/:postId", authentication, async (req, res) => {
    const { postId } = req.params;
    console.log(postId)
    try {
        const deletepostid = await Userpost.findByIdAndDelete({ _id: postId });
        if (!deletepostid) {
            res.status(400).json({
                msg: "post not found"
            })
        }
        res.status(200).json({
            msg: "Post deleted Successfully"
        })
    }
    catch (error) {
        console.log("Error deleting Post", error)
    }
})


app.put("/updatepost/:postId", authentication, upload.single('image'), async (req, res) => {
    const { postId } = req.params;
    const { post } = req.body;
    console.log(post)
    console.log(postId)

    try {

        const userpost = await Userpost.findOne({ _id: postId })

        if (!userpost) {
            return res.status(404).json({
                msg: "Post not found"
            })

        }
        const imagePath = req.file ? `images/${req.file.filename}` : userpost.image;
        userpost.post = post || userpost.post;
        userpost.image = imagePath

        await userpost.save();
        res.status(200).json({
            msg: "Post Updated Successfully"
        })
    }
    catch (error) {
        res.status(500).json({
            msg: "sorry"
        })
    }
})


// Like Post
app.post("/likepost/:postId", authentication, async (req, res) => {
    const {postId}  = req.params;
    const userId = req.user.userId;
    console.log("postid",postId)

    try {
        const userpost = await Userpost.findById({_id:postId});
console.log(userpost)
        

        if (userpost.likedBy.includes(userId)) {
            return res.status(400).json({ msg: "Already liked" });
        }

        userpost.likes += 1;
        userpost.likedBy.push(userId);
        await userpost.save();

        // Emit like event
        io.emit("postLiked", { postId, likes: userpost.likes, userId, liked: true });

        res.status(200).json({ msg: "Post liked successfully", likes: userpost.likes });
    } catch (error) {
        res.status(500).json({ msg: "Error liking post", error });
    }
});

// Unlike Post
app.post("/unlikepost/:postId", authentication, async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.userId;

    try {
        const userpost = await Userpost.findById({_id:postId});

        // if (!userpost) {
        //     return res.status(404).json({ msg: "Post not found" });
        // }

        if (!userpost.likedBy.includes(userId)) {
            return res.status(400).json({ msg: "Not liked yet" });
        }

        userpost.likes -= 1;
        userpost.likedBy = userpost.likedBy.filter((id) => id !== userId);
        await userpost.save();

        // Emit unlike event
        io.emit("postLiked", { postId, likes: userpost.likes, userId, liked: false });

        res.status(200).json({ msg: "Post unliked successfully", likes: userpost.likes });
    } catch (error) {
        res.status(500).json({ msg: "Error unliking post", error });
    }
});







server.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});

// app.listen(port,()=>{
//     console.log("Port Running at:", port)
// })

