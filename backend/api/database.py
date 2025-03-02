# backend/api/database.py

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    price = db.Column(db.String(100), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)

# You can then set up functions to add, retrieve, or delete products.
