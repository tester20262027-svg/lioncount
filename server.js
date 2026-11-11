const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const argon2 = require("argon2");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && (!SESSION_SECRET || SESSION_SECRET.length < 32)) {
  throw new Error("Set SESSION_SECRET to a random secret of at least 32 characters.");
}
const db = new Database(process.env.DB_PATH || "lioncount.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS profiles (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 display_name TEXT NOT NULL DEFAULT '',
 goals TEXT NOT NULL DEFAULT '',
 restrictions TEXT NOT NULL DEFAULT '',
 favorites TEXT NOT NULL DEFAULT '',
 least_favorites TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
app.disable("x-powered-by");
app.use(helmet({
 contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], objectSrc: ["'none'"]
 }}
}));
app.use(express.json({limit:"20kb"}));
app.use(session({
 store: new SQLiteStore({db:"sessions.sqlite",dir:process.env.DATA_DIR||"."}),
 secret: SESSION_SECRET || "local-development-only-change-this-secret",
 resave:false, saveUninitialized:false, name:"lioncount.sid",
 cookie:{httpOnly:true,sameSite:"strict",secure:isProduction,maxAge:7*24*60*60*1000}
}));
const authLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:"draft-7",legacyHeaders:false});
const clean=(v,max=1000)=>typeof v==="string"?v.trim().slice(0,max):"";
const validUsername=v=>typeof v==="string"&&/^[a-zA-Z0-9_]{3,24}$/.test(v);
function auth(req,res,next){if(!req.session.userId)return res.status(401).json({error:"Please log in first."});next();}

app.post("/api/register",authLimiter,async(req,res)=>{
 const username=clean(req.body.username,24),password=typeof req.body.password==="string"?req.body.password:"";
 if(!validUsername(username))return res.status(400).json({error:"Username must be 3–24 characters using letters, numbers, or underscores."});
 if(password.length<12||password.length>128)return res.status(400).json({error:"Password must be 12–128 characters long."});
 try{
  const hash=await argon2.hash(password,{type:argon2.argon2id});
  const r=db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,hash);
  db.prepare("INSERT INTO profiles(user_id,display_name) VALUES(?,?)").run(r.lastInsertRowid,username);
  req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Could not start session."});req.session.userId=Number(r.lastInsertRowid);res.status(201).json({user:{username}});});
 }catch(e){if(String(e.code).includes("SQLITE_CONSTRAINT"))return res.status(409).json({error:"That username is already taken."});console.error(e);res.status(500).json({error:"Could not create account."});}
});
app.post("/api/login",authLimiter,async(req,res)=>{
 const username=clean(req.body.username,24),password=typeof req.body.password==="string"?req.body.password:"";
 const user=db.prepare("SELECT id,username,password_hash FROM users WHERE username=? COLLATE NOCASE").get(username);
 const ok=user&&await argon2.verify(user.password_hash,password).catch(()=>false);
 if(!ok)return res.status(401).json({error:"Username or password is incorrect."});
 req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Could not start session."});req.session.userId=user.id;res.json({user:{username:user.username}});});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("lioncount.sid",{httpOnly:true,sameSite:"strict",secure:isProduction});res.json({ok:true});}));
app.get("/api/me",auth,(req,res)=>{const u=db.prepare("SELECT username FROM users WHERE id=?").get(req.session.userId);if(!u)return res.status(401).json({error:"Account not found."});res.json({user:u});});
app.get("/api/profile",auth,(req,res)=>{
 const p=db.prepare("SELECT display_name AS name,goals,restrictions,favorites,least_favorites AS leastFavorites FROM profiles WHERE user_id=?").get(req.session.userId);
 res.json({profile:p});
});
app.put("/api/profile",auth,(req,res)=>{
 const v={name:clean(req.body.name,70),goals:clean(req.body.goals),restrictions:clean(req.body.restrictions),favorites:clean(req.body.favorites),least:clean(req.body.leastFavorites),userId:req.session.userId};
 if(!v.name)return res.status(400).json({error:"Please enter a display name."});
 db.prepare(`UPDATE profiles SET display_name=@name,goals=@goals,restrictions=@restrictions,favorites=@favorites,least_favorites=@least,updated_at=CURRENT_TIMESTAMP WHERE user_id=@userId`).run(v);
 res.json({ok:true});
});
app.use(express.static(path.join(__dirname,"public")));
app.listen(PORT,()=>console.log(`Lioncount running at http://localhost:${PORT}`));
