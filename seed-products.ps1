$env:SUPABASE_URL="https://lrosvvrbxkpyzlprlyzt.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb3N2dnJieGtweXpscHJseXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNTMxNjYsImV4cCI6MjA4NDkyOTE2Nn0.R-knhN4XbH03RGdXa1XgLEREBvxH2KFpicbnM25dFFY"

$headers = @{
  "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
  "Authorization" = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
  "Content-Type" = "application/json"
}

$products = Get-Content .\seed.products.json -Raw | ConvertFrom-Json

foreach ($p in $products) {
  $body = @{
    brand = $p.brand
    model_name = $p.model_name
    category = $p.category
    technical_specs = $p.technical_specs
  } | ConvertTo-Json -Depth 6

  Invoke-RestMethod `
    -Method Post `
    -Uri "$($env:SUPABASE_URL)/rest/v1/products" `
    -Headers $headers `
    -Body $body
}
