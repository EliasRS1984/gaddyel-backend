#!/bin/bash
# 🔍 Pre-Push Validation Script
# Verifica que el repositorio está listo para GitHub

echo "═════════════════════════════════════════════════════════"
echo "🔍 PRE-PUSH VALIDATION SCRIPT"
echo "═════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0

# 1. Verificar que .env NO está en git
echo "1️⃣  Verificando que .env está ignorado..."
if git ls-files | grep -q "^\.env$"; then
    echo -e "${RED}❌ ERROR: .env está en git (DEBE SER IGNORADO)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ .env correctamente ignorado${NC}"
fi

# 2. Verificar que .env.example SÍ está en git
echo ""
echo "2️⃣  Verificando que .env.example está incluido..."
if git ls-files | grep -q "^\.env\.example$"; then
    echo -e "${GREEN}✅ .env.example correctamente incluido${NC}"
else
    echo -e "${RED}❌ ERROR: .env.example no está en git (DEBE ESTAR)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 3. Verificar que node_modules NO está en git
echo ""
echo "3️⃣  Verificando que node_modules está ignorado..."
if git ls-files | grep -q "^node_modules"; then
    echo -e "${RED}❌ ERROR: node_modules está en git (DEBE SER IGNORADO)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ node_modules correctamente ignorado${NC}"
fi

# 4. Verificar que uploads/ NO está en git
echo ""
echo "4️⃣  Verificando que uploads/ está ignorado..."
if git ls-files | grep -q "^uploads/"; then
    echo -e "${RED}❌ ERROR: uploads/ está en git (DEBE SER IGNORADO)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ uploads/ correctamente ignorado${NC}"
fi

# 5. Verificar que src/ está en git
echo ""
echo "5️⃣  Verificando que src/ está incluido..."
if git ls-files | grep -q "^src/"; then
    echo -e "${GREEN}✅ src/ correctamente incluido${NC}"
else
    echo -e "${RED}❌ ERROR: src/ no está en git (DEBE ESTAR)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 6. Verificar que package.json está en git
echo ""
echo "6️⃣  Verificando que package.json está incluido..."
if git ls-files | grep -q "^package.json$"; then
    echo -e "${GREEN}✅ package.json correctamente incluido${NC}"
else
    echo -e "${RED}❌ ERROR: package.json no está en git (DEBE ESTAR)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 7. Verificar que vercel.json está en git
echo ""
echo "7️⃣  Verificando que vercel.json está incluido..."
if git ls-files | grep -q "^vercel.json$"; then
    echo -e "${GREEN}✅ vercel.json correctamente incluido${NC}"
else
    echo -e "${RED}❌ ERROR: vercel.json no está en git (DEBE ESTAR)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 8. Verificar que README.md está en git
echo ""
echo "8️⃣  Verificando que README.md está incluido..."
if git ls-files | grep -q "^README.md$"; then
    echo -e "${GREEN}✅ README.md correctamente incluido${NC}"
else
    echo -e "${RED}❌ ERROR: README.md no está en git (DEBE ESTAR)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 9. Verificar que .gitignore existe
echo ""
echo "9️⃣  Verificando que .gitignore existe..."
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}✅ .gitignore existe${NC}"
else
    echo -e "${RED}❌ ERROR: .gitignore no existe${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 10. Verificar que hay commits
echo ""
echo "🔟 Verificando que hay commits..."
if git log --oneline | head -1 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Hay commits en el historial${NC}"
    git log --oneline | head -5
else
    echo -e "${YELLOW}⚠️  Sin commits aún (normal para primer push)${NC}"
fi

# Resumen
echo ""
echo "═════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ VALIDACIÓN EXITOSA - Listo para push${NC}"
    echo ""
    echo "Próximo paso:"
    echo "  git push -u origin main"
else
    echo -e "${RED}❌ VALIDACIÓN FALLIDA - $ERRORS error(s) encontrado(s)${NC}"
    echo ""
    echo "Revisa los errores arriba y corrígelos antes de hacer push"
fi
echo "═════════════════════════════════════════════════════════"
