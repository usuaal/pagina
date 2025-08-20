from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
import jwt
import hashlib

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client.inventory_db

# JWT Configuration
JWT_SECRET = "your-secret-key-here-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Pydantic models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    full_name: str
    created_at: datetime
    is_active: bool = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    created_at: datetime
    is_active: bool

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    barcode: Optional[str] = ""
    pieces_per_pallet: Optional[int] = None  # None means variable pallet size
    current_stock_pieces: int = 0
    current_stock_pallets: int = 0
    min_stock_alert: Optional[int] = 0
    price_per_piece: Optional[float] = 0.0
    category: Optional[str] = ""
    created_at: datetime
    updated_at: datetime
    created_by: str  # user_id

class InventoryMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    movement_type: str  # "entry" or "exit"
    quantity_pieces: int
    quantity_pallets: int
    movement_reason: Optional[str] = ""
    barcode_scanned: Optional[str] = ""
    created_at: datetime
    created_by: str  # user_id
    user_name: str   # username for display

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash

def create_access_token(user_id: str, username: str) -> str:
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        username = payload.get("username")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Verify user exists
        user = await db.users.find_one({"id": user_id})
        if not user or not user.get("is_active"):
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        return {"user_id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def prepare_for_mongo(data):
    if isinstance(data, dict):
        if 'created_at' in data and isinstance(data['created_at'], datetime):
            data['created_at'] = data['created_at'].isoformat()
        if 'updated_at' in data and isinstance(data['updated_at'], datetime):
            data['updated_at'] = data['updated_at'].isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        if 'created_at' in item and isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if 'updated_at' in item and isinstance(item['updated_at'], str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return item

# Auth endpoints
@app.post("/api/auth/register", response_model=dict)
async def register_user(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        created_at=datetime.now(timezone.utc)
    )
    
    user_dict = prepare_for_mongo(user.dict())
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token(user.id, user.username)
    
    return {
        "token": token,
        "user": UserResponse(**user.dict())
    }

@app.post("/api/auth/login", response_model=dict)
async def login_user(login_data: UserLogin):
    # Find user
    user = await db.users.find_one({"username": login_data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Create token
    token = create_access_token(user["id"], user["username"])
    
    user_response = UserResponse(**parse_from_mongo(user))
    
    return {
        "token": token,
        "user": user_response
    }

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(**parse_from_mongo(user))

# Product endpoints
@app.get("/api/products", response_model=List[Product])
async def get_products(current_user: dict = Depends(get_current_user)):
    products = await db.products.find().to_list(length=None)
    return [Product(**parse_from_mongo(product)) for product in products]

@app.get("/api/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return Product(**parse_from_mongo(product))

@app.get("/api/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"barcode": barcode})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado con ese código de barras")
    return Product(**parse_from_mongo(product))

@app.post("/api/products", response_model=Product)
async def create_product(product: Product, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    product.created_at = now
    product.updated_at = now
    product.created_by = current_user["user_id"]
    
    product_dict = prepare_for_mongo(product.dict())
    await db.products.insert_one(product_dict)
    return product

@app.put("/api/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_update: Product, current_user: dict = Depends(get_current_user)):
    product_update.updated_at = datetime.now(timezone.utc)
    product_dict = prepare_for_mongo(product_update.dict())
    
    result = await db.products.replace_one({"id": product_id}, product_dict)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return product_update

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado exitosamente"}

# Inventory movement endpoints
@app.get("/api/movements", response_model=List[InventoryMovement])
async def get_movements(current_user: dict = Depends(get_current_user)):
    movements = await db.movements.find().sort("created_at", -1).to_list(length=100)
    return [InventoryMovement(**parse_from_mongo(movement)) for movement in movements]

@app.get("/api/movements/{product_id}", response_model=List[InventoryMovement])
async def get_product_movements(product_id: str, current_user: dict = Depends(get_current_user)):
    movements = await db.movements.find({"product_id": product_id}).sort("created_at", -1).to_list(length=50)
    return [InventoryMovement(**parse_from_mongo(movement)) for movement in movements]

@app.post("/api/movements", response_model=InventoryMovement)
async def create_movement(movement: InventoryMovement, current_user: dict = Depends(get_current_user)):
    # Validate product exists
    product = await db.products.find_one({"id": movement.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    movement.created_at = datetime.now(timezone.utc)
    movement.created_by = current_user["user_id"]
    movement.user_name = current_user["username"]
    
    movement_dict = prepare_for_mongo(movement.dict())
    await db.movements.insert_one(movement_dict)
    
    # Update product stock
    product_obj = Product(**parse_from_mongo(product))
    
    if movement.movement_type == "entry":
        product_obj.current_stock_pieces += movement.quantity_pieces
        product_obj.current_stock_pallets += movement.quantity_pallets
    else:  # exit
        product_obj.current_stock_pieces = max(0, product_obj.current_stock_pieces - movement.quantity_pieces)
        product_obj.current_stock_pallets = max(0, product_obj.current_stock_pallets - movement.quantity_pallets)
    
    product_obj.updated_at = datetime.now(timezone.utc)
    updated_product_dict = prepare_for_mongo(product_obj.dict())
    await db.products.replace_one({"id": movement.product_id}, updated_product_dict)
    
    return movement

# Barcode generation endpoint
@app.get("/api/generate-barcode/{format}")
async def generate_barcode(format: str, current_user: dict = Depends(get_current_user)):
    """Generate a new barcode in specified format (EAN13, UPC, CODE128)"""
    if format.upper() == "EAN13":
        # Generate 13-digit EAN code (12 digits + check digit)
        import random
        code = "".join([str(random.randint(0, 9)) for _ in range(12)])
        # Simple EAN-13 check digit calculation
        odd_sum = sum([int(code[i]) for i in range(0, 12, 2)])
        even_sum = sum([int(code[i]) for i in range(1, 12, 2)])
        check_digit = (10 - ((odd_sum + even_sum * 3) % 10)) % 10
        barcode = code + str(check_digit)
    elif format.upper() == "UPC":
        # Generate 12-digit UPC code
        import random
        code = "".join([str(random.randint(0, 9)) for _ in range(11)])
        # Simple UPC check digit calculation
        odd_sum = sum([int(code[i]) for i in range(0, 11, 2)])
        even_sum = sum([int(code[i]) for i in range(1, 11, 2)])
        check_digit = (10 - ((odd_sum * 3 + even_sum) % 10)) % 10
        barcode = code + str(check_digit)
    else:  # CODE128
        import random
        barcode = "INV" + "".join([str(random.randint(0, 9)) for _ in range(10)])
    
    return {"barcode": barcode, "format": format.upper()}

# Dashboard/Statistics endpoints
@app.get("/api/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_products = await db.products.count_documents({})
    total_movements = await db.movements.count_documents({})
    
    # Low stock products
    low_stock_products = []
    async for product in db.products.find():
        product_obj = Product(**parse_from_mongo(product))
        if product_obj.current_stock_pieces <= product_obj.min_stock_alert:
            low_stock_products.append(product_obj.name)
    
    # Recent movements (limited to 3)
    recent_movements = await db.movements.find().sort("created_at", -1).limit(3).to_list(length=3)
    
    return {
        "total_products": total_products,
        "total_movements": total_movements,
        "low_stock_count": len(low_stock_products),
        "low_stock_products": low_stock_products[:3],
        "recent_movements": [InventoryMovement(**parse_from_mongo(mov)) for mov in recent_movements]
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Inventory Management API"}