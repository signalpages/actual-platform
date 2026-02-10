-- Inspect products table schema
select column_name, data_type 
from information_schema.columns 
where table_name = 'products';

-- List all products
select id, brand, model_name, slug, category, created_at
from products
limit 20;

-- Check for other potential product tables
select table_name 
from information_schema.tables 
where table_schema = 'public' 
and table_name ilike '%product%' OR table_name ilike '%asset%' OR table_name ilike '%item%';
