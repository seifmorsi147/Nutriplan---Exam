import { mealApi } from '../API/mealdb.js';

export class uiManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.initElements();
        this.initEvents();
        this.archivePreviousDay();
        this.renderFoodLog();
        this.renderWeeklyOverview();
        this.currentView = "grid"; //* Default view state
        this.currentMeals = []; //* Cache to store the currently loaded meals
        this.activeFilterType = ""; //* To track if filter is 'category' or 'area'
        this.activeFilterValue = ""; //* To store the name of the country or category

        //* Single source of truth for the Products page search + Nutri-Score filter
        this.productSearchState = {
            query: "",      // current text in the search box (empty = browse all)
            grade: ""       // selected Nutri-Score grade ('', 'a', 'b', 'c', 'd', 'e')
        };
    }
    //* Get DOM Elements ==>
    initElements() {
        this.navLinks = document.querySelectorAll(".sidebar-link , [data-page] ");

        //* Grouping home page sections into an array and filtering out missing elements
        this.mealsSections = [
            document.getElementById("search-filters-section"),
            document.getElementById("meal-categories-section"),
            document.getElementById("all-recipes-section"),
        ].filter((el) => el !== null);

        this.productsSection = document.getElementById("products-section");
        this.foodLogSection = document.getElementById("foodlog-section");

        //* Target main header elements for dynamic content updates
        this.pageTitle = document.getElementById("main-h1");
        this.pageDescription = document.getElementById("main-p");

        //* sidebar ===>
        this.menuToggleBtn = document.getElementById("header-menu-btn");
        this.sidebarCloseBtn = document.getElementById("sidebar-close-btn");
        this.sidebar = document.getElementById("sidebar");

        //* cuisines-container & categories-container ==>
        this.cuisinesContainer = document.getElementById("cuisines-container");
        this.categoriesContainer = document.getElementById("categories-container");

        //* recipesGrid ===>
        this.recipesGrid = document.getElementById("recipes-grid");

        //* Target the paragraph that displays the recipes count
        this.recipesCountText = document.getElementById("recipes-count");

        //* Target the layout toggle buttons
        this.btnGridView = document.getElementById("grid-view-btn");
        this.btnListView = document.getElementById("list-view-btn");

        //* get Search input 
        this.searchInput = document.getElementById("search-input");
    }

    //* Set Event Listeners ==>
    initEvents() {
        //* Handle sidebar link clicks for custom routing
        this.navLinks.forEach((link) => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const targetPage = link.getAttribute("data-page");
                if (targetPage) {
                    const mealDetailsSection = document.getElementById('meal-details');
                    if (mealDetailsSection) {
                        mealDetailsSection.style.setProperty('display', 'none', 'important');
                        mealDetailsSection.classList.add('hidden');
                    }
                    if (targetPage === 'recipes' || targetPage === 'meals') {
                        const mainTitle = document.getElementById('main-h1');
                        const mainDesc = document.getElementById('main-p');
                        if (mainTitle) mainTitle.textContent = 'Meals & Recipes';
                        if (mainDesc) mainDesc.style.display = 'block';
                    }
                    this.navigateTo(targetPage);
                }
            });
        });

        //* Handle browser back and forward navigation
        // window.addEventListener("popstate", (e) => {
        //     if (e.state && e.state.page) {
        //         this.randerPage(e.state.page);
        //     }
        // });

        if (this.menuToggleBtn && this.sidebar) {
            this.menuToggleBtn.addEventListener("click", () => {
                this.sidebar.classList.remove("-translate-x-full");
                this.sidebar.classList.add("translate-x-0");
            });
        }

        if (this.sidebarCloseBtn && this.sidebar) {
            this.sidebarCloseBtn.addEventListener("click", () => {
                this.sidebar.classList.remove("translate-x-0");
                this.sidebar.classList.add("-translate-x-full");
            });
        }

        //* Bind click events to layout toggle buttons
        if (this.btnGridView && this.btnListView) {
            this.btnGridView.addEventListener("click", () => {
                this.switchView("grid");
            });
            this.btnListView.addEventListener("click", () => {
                this.switchView("list");
            });
        }

        //* Bind click triggers for top cuisines filter container
        if (this.cuisinesContainer) {
            this.cuisinesContainer.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-cuisine]");
                if (btn) {
                    const cuisine = btn.getAttribute("data-cuisine");
                    this.filterByComponent("area", cuisine, btn);
                }
            });
        }

        //* Bind click triggers for categories cards grid container
        if (this.categoriesContainer) {
            this.categoriesContainer.addEventListener("click", (e) => {
                const card = e.target.closest("[data-category]");
                if (card) {
                    const category = card.getAttribute("data-category");
                    this.filterByComponent("category", category);
                }
            });
        }

        //* Event Search 
        this.searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            if (!query) {
                this.filterByComponent("area", "all");
                return;
            }

            this.recipesGrid.innerHTML = `
            <div class="flex items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
                `;

            this.activeFilterType = 'search';
            this.activeFilterValue = query;

            this.handleLiveSearch(query);
        });
        //*======================================
        // Nutri-Score Filter
        document.querySelectorAll('.nutri-score-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const grade = btn.getAttribute('data-grade') || '';

                document.querySelectorAll('.nutri-score-filter').forEach(b => {
                    b.classList.remove('bg-emerald-600', 'text-white');
                });
                btn.classList.add('bg-emerald-600', 'text-white');

                this.productSearchState.grade = grade;
                this.runProductSearch();
            });
        });
        //* ================================
        const searchBtn = document.getElementById('search-product-btn');

        searchBtn.addEventListener('click', () => {
            const query = document.getElementById('product-search-input').value.trim();
            if (!query) return;

            this.productSearchState.query = query;
            this.runProductSearch();
        });
        //*=======================================
        const lookupBtn = document.getElementById('lookup-barcode-btn');
        lookupBtn?.addEventListener('click', async () => {
            const barcode = document.getElementById('barcode-input').value.trim();
            if (!barcode) return;

            const resultsLabel = document.getElementById('products-results-label');

            const grid = document.getElementById('products-grid');
            grid.innerHTML = `
        <div class="flex items-center justify-center py-12 col-span-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    `;

            const data = await this.app.api.getProductByBarcode(barcode);
            console.log("Barcode Result:", data);

            if (data && data.result) {
                if (resultsLabel) resultsLabel.textContent = `Found: ${data.result.name}`;
                this.renderProducts([data.result]);
            } else {
                if (resultsLabel) resultsLabel.textContent = 'Product not found';
                grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-barcode text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 font-medium">Product not found</p>
                <p class="text-gray-400 text-sm mt-1">Try a different barcode</p>
            </div>
        `;
            }
        });
        //*========================================
        document.getElementById('barcode-input')?.addEventListener('input', (e) => {
            if (!e.target.value.trim()) {
                const resultsLabel = document.getElementById('products-results-label');
                if (resultsLabel) resultsLabel.textContent = 'Search for products to see results';

                document.getElementById('products-grid').innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-box-open text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 font-medium">No products to display</p>
                <p class="text-gray-400 text-sm mt-1">Search for a product or browse by category</p>
            </div>
        `;
            }
        });
        //*=======================================
        document.getElementById('product-search-input')?.addEventListener('input', (e) => {
            if (!e.target.value.trim()) {
                this.productSearchState.query = '';

                const resultsLabel = document.getElementById('products-results-label');
                if (resultsLabel) resultsLabel.textContent = 'Search for products to see results';

                document.getElementById('products-grid').innerHTML = `
            <div class="flex flex-col items-center justify-center col-span-3 py-16 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-box-open text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 font-medium">No products to display</p>
                <p class="text-gray-400 text-sm mt-1">Search for a product or browse by category</p>
            </div>
        `;
            }
        });
        //*==================================
        document.addEventListener('click', async (event) => {
            const card = event.target.closest('.recipe-card');

            if (card) {
                const mealId = card.getAttribute('data-meal-id');

                if (mealId) {

                    const searchSection = document.getElementById('search-filters-section');
                    const categoriesSection = document.getElementById('meal-categories-section');
                    const allRecipesSection = document.getElementById('all-recipes-section');

                    if (searchSection) { searchSection.style.setProperty('display', 'none', 'important'); searchSection.classList.add('hidden'); }
                    if (categoriesSection) { categoriesSection.style.setProperty('display', 'none', 'important'); categoriesSection.classList.add('hidden'); }
                    if (allRecipesSection) { allRecipesSection.style.setProperty('display', 'none', 'important'); allRecipesSection.classList.add('hidden'); }

                    const mealDetailsSection = document.getElementById('meal-details');
                    if (mealDetailsSection) {
                        mealDetailsSection.style.setProperty('display', 'block', 'important');
                        mealDetailsSection.classList.remove('hidden');
                    }

                    try {
                        const api = new mealApi();
                        const meal = await api.getMealDetails(mealId);

                        if (meal) {
                            this.renderMealDetailsPage(meal);

                            const mainTitle = document.getElementById('main-h1');
                            const mainDesc = document.getElementById('main-p');

                            if (mainTitle) mainTitle.textContent = "Recipe Details";
                            if (mainDesc) mainDesc.style.display = 'View full recipe information and nutrition facts';

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    } catch (err) {
                        console.error("Error fetching meal details from API class:", err);
                    }
                }
            }

            const backBtn = event.target.closest('#back-to-recipes-btn');
            if (backBtn) {
                const searchSection = document.getElementById('search-filters-section');
                const categoriesSection = document.getElementById('meal-categories-section');
                const allRecipesSection = document.getElementById('all-recipes-section');
                const mealDetailsSection = document.getElementById('meal-details');

                if (searchSection) { searchSection.style.setProperty('display', 'block', 'important'); searchSection.classList.remove('hidden'); }
                if (categoriesSection) { categoriesSection.style.setProperty('display', 'block', 'important'); categoriesSection.classList.remove('hidden'); }
                if (allRecipesSection) { allRecipesSection.style.setProperty('display', 'block', 'important'); allRecipesSection.classList.remove('hidden'); }

                if (mealDetailsSection) {
                    mealDetailsSection.style.setProperty('display', 'none', 'important');
                    mealDetailsSection.classList.add('hidden');
                }
                const mainTitle = document.getElementById('main-h1');
                const mainDesc = document.getElementById('main-p');

                if (mainTitle) mainTitle.textContent = 'Meals & Recipes';
                if (mainDesc) mainDesc.style.display = 'block';

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        //*========================================
        const quickLogBtns = document.querySelectorAll('.quick-log-btn');
        quickLogBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const targetPage = btn.getAttribute('data-page');

                if (targetPage) {
                    this.navigateTo(targetPage);

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    //* Update Browser URL ==>
    navigateTo(pageName) {
        history.pushState({ page: pageName }, null, `#${pageName}`);
        this.randerPage(pageName);
    }

    //* Render Active Page and Hide Others ==>
    randerPage(pageName) {
        const page = pageName.toLowerCase();

        //* Hide all views by default before rendering the selected page
        this.toggleMealsDisplay(false);
        if (this.productsSection) {
            this.productsSection.style.setProperty("display", "none", "important");
            this.productsSection.classList.add("hidden");
        }
        if (this.foodLogSection) {
            this.foodLogSection.style.setProperty("display", "none", "important");
            this.foodLogSection.classList.add("hidden");
        }

        //* Toggle visibility and update headers based on current route
        switch (page) {
            case "home":
                this.toggleMealsDisplay(true);
                this.updateHeader(
                    "Meals & Recipes",
                    "Discover delicious and nutritious recipes tailored for you",
                );

                //* Fetch and dynamically render categories grid
                this.app.api.getCategories().then((categories) => {
                    if (categories) this.renderCategories(categories);
                });

                //* Fetch and dynamically render cuisines filter chips
                this.app.api.getCuisines().then((cuisines) => {
                    if (cuisines) this.renderCuisines(cuisines);
                });

                this.activeFilterType = "";
                this.activeFilterValue = "";
                this.app.api.searchMeals("").then((meals) => {
                    this.currentMeals = meals ? meals.slice(0, 25) : [];
                    this.renderMeals(this.currentMeals);
                });
                break;

            case "products":
                this.app.api.getProductCategories().then(categories => {
                    this.renderProductCategories(categories);
                });
                if (this.productsSection) {
                    this.productsSection.style.setProperty(
                        "display",
                        "block",
                        "important",
                    );
                    this.productsSection.classList.remove("hidden");
                }
                this.updateHeader(
                    "Product Scanner",
                    "Search packaged foods by name or barcode",
                );
                const productsGrid = document.getElementById('products-grid');
                if (productsGrid) {
                    productsGrid.innerHTML = `
    <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <i class="fa-solid fa-box-open text-gray-400 text-2xl"></i>
        </div>
        <p class="text-gray-500 font-medium">No products to display</p>
        <p class="text-gray-400 text-sm mt-1">Search for a product or browse by category</p>
    </div>
`;
                }
                break;


            case "foodlog":
                if (this.foodLogSection) {
                    this.foodLogSection.style.setProperty(
                        "display",
                        "block",
                        "important",
                    );
                    this.foodLogSection.classList.remove("hidden");
                }
                this.updateHeader(
                    "Food Log",
                    "Track your daily nutrition and food intake",
                );

                if (typeof this.renderFoodLog === 'function') {
                    this.renderFoodLog();
                }
                break;

        }

        //* Update active sidebar link styling
        this.updateActiveLink(page);

        if (this.sidebar && window.innerWidth < 1024) {
            this.sidebar.classList.remove("translate-x-0");
            this.sidebar.classList.add("-translate-x-full");
        }
    }

    //* Dynamic Header Content Updater ==>
    updateHeader(title, description) {
        if (this.pageTitle) this.pageTitle.textContent = title;
        if (this.pageDescription) this.pageDescription.textContent = description;
    }

    //* Dynamic Sidebar Active State Link Switcher ==>
    updateActiveLink(activePage) {
        this.navLinks.forEach((link) => {
            const linkPage = link.getAttribute("data-page")?.toLowerCase();

            //* Apply active styles to matching route, fallback for home/meals link matching
            if (
                linkPage === activePage ||
                (activePage === "home" && linkPage === "meals")
            ) {
                link.classList.add("bg-emerald-50", "text-emerald-600", "font-medium");
                link.classList.remove("text-gray-600");
            } else {
                link.classList.remove(
                    "bg-emerald-50",
                    "text-emerald-600",
                    "font-medium",
                );
                link.classList.add("text-gray-600");
            }
        });
    }

    //* Show/Hide Home Page Sections Helper ==>
    toggleMealsDisplay(shouldShow) {
        if (this.mealsSections && this.mealsSections.length > 0) {
            this.mealsSections.forEach((section) => {
                if (section) {
                    if (shouldShow) {
                        section.style.setProperty("display", "block", "important");
                        section.classList.remove("hidden");
                    } else {
                        section.style.setProperty("display", "none", "important");
                        section.classList.add("hidden");
                    }
                }
            });
        }
    }
    //*======================================
    //* display Meals in recipesGrid ===>
    renderMeals(meals, forcedFilterName = "") {
        if (!this.recipesGrid) {
            return;
        }

        this.recipesGrid.innerHTML = "";
        this.recipesGrid.className = this.currentView === 'list'
            ? "grid grid-cols-1 md:grid-cols-2 gap-6 w-full"
            : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full";

        // Handle empty meals array and display empty state UI
        if (!meals || meals.length === 0) {
            if (this.recipesCountText) {
                const currentFilter = forcedFilterName || this.activeFilterValue || "";
                const filterText = currentFilter ? ` ${currentFilter}` : "";
                this.recipesCountText.textContent = `Showing ${meals.length}${filterText} recipes `;
            }
            this.recipesGrid.innerHTML = `
            <div class="flex flex-col items-center justify-center col-span-full py-12 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-magnifying-glass text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 text-lg font-medium">No recipes found</p>
                <p class="text-gray-400 text-sm mt-1">Try searching for something else</p>
            </div>`;
            return;
        }

        // Dynamically update the count paragraph text using context reference
        if (this.recipesCountText) {
            const currentFilter = forcedFilterName || this.activeFilterValue || "";
            const filterText = currentFilter ? ` ${currentFilter}` : "";
            this.recipesCountText.textContent = `Showing ${meals.length}${filterText} recipes found`;
        }

        // Identify if the active view layout is a list
        const isList = this.currentView === "list";

        meals.forEach((meal) => {
            const isList = this.currentView === "list";
            const category = meal.strCategory || (this.activeFilterType === "category" ? this.activeFilterValue : "Side");
            const area = meal.strArea || (this.activeFilterType === "area" ? this.activeFilterValue : "International");
            const mealCard = `
<div class="recipe-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group ${isList ? "flex flex-row h-40" : ""}" data-meal-id="${meal.idMeal}">
    
    <div class="relative ${isList ? "w-1/3 h-full" : "h-48"} overflow-hidden">
        <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
             src="${meal.strMealThumb}"
             alt="${meal.strMeal}"
             loading="lazy" />
        
        <div class="absolute bottom-3 left-3 flex gap-2 ${isList ? "hidden" : ""}">
            ${category ? `<span class="px-2 py-1 bg-white/90 backdrop-blur-sm text-xs font-semibold rounded-lg flex items-center gap-1 text-gray-700 shadow-xs">
                    <i class="fa-solid fa-tag text-emerald-600"></i>${category}</span>` : ""}${area ? `
                <span class="px-2 py-1 bg-white/90 backdrop-blur-sm text-xs font-semibold rounded-lg flex items-center gap-1 text-gray-700 shadow-xs">
                    <i class="fa-solid fa-globe text-blue-600"></i>
                    ${area} </span>` : ""}
        </div>
    </div>
    <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
            <h3 class="text-base font-bold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-1">
                ${meal.strMeal}
            </h3>
            <p class="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                ${meal.strInstructions || `Learn how to prepare delicious ${meal.strMeal} with simple steps...`}
            </p>
        </div>

        <div class="flex items-center justify-between text-xs font-semibold text-gray-500 mt-auto">
            <span class="flex items-center gap-1 text-emerald-600">
                <i class="fa-solid fa-utensils"></i>
                    ${category}
            </span>
            <span class="flex items-center gap-1 text-blue-500">
                 <i class="fa-solid fa-globe"></i>
                ${area}
            </span>
        </div>
    </div>
            </div> `;
            this.recipesGrid.insertAdjacentHTML("beforeend", mealCard);
        });
        //*===========================
        const recipeCards = document.querySelectorAll('.recipe-card');

        recipeCards.forEach(card => {
            card.addEventListener('click', () => {
                const mealId = card.getAttribute('data-meal-id');

                if (mealId) {
                    this.showMealDetailsById(mealId);
                }
            });
        });
    }
    //*=========================================
    switchView(viewType) {
        // If the clicked view is already active, do nothing
        if (this.currentView === viewType) return;

        this.currentView = viewType;

        // Toggle active button styles and modify grid layout classes
        if (viewType === "grid") {
            if (this.btnGridView)
                this.btnGridView.classList.add("bg-white", "shadow-xs");
            if (this.btnListView)
                this.btnListView.classList.remove("bg-white", "shadow-xs");

            // Grid View layout configuration (4 columns display)
            if (this.recipesGrid)
                this.recipesGrid.className = "grid grid-cols-4 gap-5";
        } else {
            if (this.btnListView)
                this.btnListView.classList.add("bg-white", "shadow-xs");
            if (this.btnGridView)
                this.btnGridView.classList.remove("bg-white", "shadow-xs");

            // List View layout configuration (2 columns display as requested)
            if (this.recipesGrid)
                this.recipesGrid.className = "grid grid-cols-2 gap-4";
        }

        // Re-render the cached meals instantly with the new layout style
        this.renderMeals(this.currentMeals);
    }
    //*=========================================
    //* Render top cuisine filter chips dynamically matching user HTML style
    renderCuisines(cuisines) {
        if (!this.cuisinesContainer) return;
        const randomCuisines = cuisines.sort(() => 0.5 - Math.random());
        const selectedCuisines = randomCuisines.slice(0, 10);
        //* Default dynamic active "All Recipes" button
        let html = `<button data-cuisine="all" class="px-4 py-2 bg-emerald-600 text-white rounded-full font-medium text-sm whitespace-nowrap hover:bg-emerald-700 transition-all cursor-pointer">
            All Recipes
        </button>`;

        //* Loop through API cuisines and append dynamic buttons
        selectedCuisines.forEach((cuisine) => {
            if (!cuisine.strArea) return;
            html += `
            <button data-cuisine="${cuisine.strArea}" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-medium text-sm whitespace-nowrap hover:bg-gray-200 transition-all cursor-pointer">
                ${cuisine.strArea}
            </button>
        `;
        });
        this.cuisinesContainer.innerHTML = html;
    }
    //*===============================================
    //*Render categories grid cards dynamically matching user HTML style
    renderCategories(categories) {
        if (!this.categoriesContainer) return;

        //* FontAwesome icons map to match specific category styles dynamically
        // Mapping icons to match exactly with specific category names
        const iconsMap = {
            Beef: "fa-drumstick-bite",
            Chicken: "fa-egg",
            Dessert: "fa-cake-candles",
            Lamb: "fa-meat",
            Pasta: "fa-bowl-food",
            Seafood: "fa-fish",
            Vegetarian: "fa-carrot",
            Vegan: "fa-leaf",
            Pork: "fa-bacon",
            Side: "fa-stroopwafel",
            Starter: "fa-utensils",
            Breakfast: "fa-mug-saucer",
            Goat: "fa-cheese",
        };

        // Precise Tailwind color configurations array matching image_f22025.png
        const linearBgColors = {
            rose: "linear-gradient(to right bottom, oklch(0.971 0.013 17.38) 0%, oklch(0.969 0.015 12.422) 100%)",
            amber: "linear-gradient(to right bottom, oklch(0.987 0.022 95.277) 0%, oklch(0.98 0.016 73.684) 100%)",
            pink: "linear-gradient(to right bottom, oklch(0.971 0.014 343.198) 0%, oklch(0.969 0.015 12.422) 100%)",
            orange: "linear-gradient(to right bottom, oklch(0.98 0.016 73.684) 0%, oklch(0.987 0.022 95.277) 100%)",
            slate: "linear-gradient(to right bottom, oklch(0.984 0.019 200.873) 0%, oklch(0.97 0.014 254.604) 100%)",
            yellow: "linear-gradient(to right bottom, oklch(0.987 0.026 102.212) 0%, oklch(0.987 0.022 95.277) 100%)",
            emerald: "linear-gradient(to right bottom, oklch(0.979 0.021 166.113) 0%, oklch(0.982 0.018 155.826) 100%)"
        };

        const borderColors = {
            rose: "oklch(0.704 0.191 22.216)",
            amber: "oklch(0.828 0.189 84.429)",
            pink: "oklch(0.718 0.202 349.761)",
            orange: "oklch(0.75 0.183 55.934)",
            slate: "oklch(0.704 0.04 256.788)",
            yellow: "oklch(0.852 0.199 91.936)",
            emerald: "oklch(0.765 0.177 163.223)"
        };

        const colorMaps = [
            { name: "rose", bgStyle: linearBgColors.rose, borderStyle: borderColors.rose, iconBg: "from-rose-400 to-rose-500" },
            { name: "amber", bgStyle: linearBgColors.amber, borderStyle: borderColors.amber, iconBg: "from-amber-400 to-amber-500" },
            { name: "pink", bgStyle: linearBgColors.pink, borderStyle: borderColors.pink, iconBg: "from-pink-400 to-pink-500" },
            { name: "orange", bgStyle: linearBgColors.orange, borderStyle: borderColors.orange, iconBg: "from-orange-400 to-orange-500" },
            { name: "slate", bgStyle: linearBgColors.slate, borderStyle: borderColors.slate, iconBg: "from-slate-400 to-slate-500" },
            { name: "yellow", bgStyle: linearBgColors.yellow, borderStyle: borderColors.yellow, iconBg: "from-yellow-400 to-yellow-500" },
            { name: "emerald", bgStyle: linearBgColors.emerald, borderStyle: borderColors.emerald, iconBg: "from-emerald-400 to-emerald-500" }
        ];

        let html = "";
        categories.forEach((cat, index) => {
            if (!cat.strCategory) return;

            const iconClass = iconsMap[cat.strCategory] || "fa-utensils";
            // Pick color layout sequentially based on index loop
            const color = colorMaps[index % colorMaps.length];

            html += `
       <div class="category-card rounded-xl p-3 hover:shadow-md cursor-pointer transition-all group" style="background-image: ${color.bgStyle}; border:.5px solid ${color.borderStyle};" data-category="${cat.strCategory}">
                <div class="flex items-center gap-2.5">
                    <div class="text-white w-9 h-9 bg-gradient-to-br ${color.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <i class="fa-solid ${iconClass} text-sm"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-900">${cat.strCategory}</h3>
                    </div>
                </div>
            </div>
        `;
        });

        this.categoriesContainer.innerHTML = html;
    }
    //*===========================================
    filterByComponent(type, value, clickedElement = null) {

        this.recipesGrid.innerHTML = `
        <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
            `;

        let fetchPromise;

        this.activeFilterType = value === "all" ? "" : type;
        this.activeFilterValue = value === "all" ? "" : value;

        if (value === "all") {
            fetchPromise = this.app.api.searchMeals("");
        } else {
            fetchPromise =
                type === "category"
                    ? this.app.api.filterByCategory(value)
                    : this.app.api.filterByArea(value);
        }

        if (type === "area") {
            document.querySelectorAll("[data-cuisine]").forEach((btn) => {
                btn.classList.remove("bg-emerald-600", "text-white");
                btn.classList.add("bg-gray-100", "text-gray-700");
            });

            if (clickedElement) {
                clickedElement.classList.remove("bg-gray-100", "text-gray-700");
                clickedElement.classList.add("bg-emerald-600", "text-white");
            } else if (value === "all") {
                const allBtn = document.querySelector('[data-cuisine="all"]');
                if (allBtn) {
                    allBtn.classList.remove("bg-gray-100", "text-gray-700");
                    allBtn.classList.add("bg-emerald-600", "text-white");
                }
            }
        }

        fetchPromise.then((meals) => {
            this.currentMeals = meals ? meals.slice(0, 25) : [];
            setTimeout(() => {
                this.renderMeals(this.currentMeals, value === 'all' ? '' : value);
            }, 800);
        });
    }
    //*===========================================
    handleLiveSearch(query) {
        const apiWorker = this.app.api;

        if (!apiWorker) {
            fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${query}`)
                .then(res => res.json())
                .then(data => {
                    setTimeout(() => {
                        this.currentMeals = data.meals || [];
                        this.renderMeals(this.currentMeals, `"${query}"`);
                    }, 500);
                });
            return;
        }

        apiWorker.searchMeals(query).then(meals => {
            setTimeout(() => {
                this.currentMeals = meals || [];
                this.renderMeals(this.currentMeals, `"${query}"`);
            }, 500);
        }).catch(err => console.error(err));
    }
    //*============================================
    toggleMainComponents(show) {
        const searchSection = document.getElementById('search-filters-section');
        const categorySection = document.getElementById('meal-categories-section');
        const recipesSection = document.getElementById('all-recipes-section');
        const detailsSection = document.getElementById('meal-details');

        if (show) {
            searchSection?.classList.remove('hidden');
            categorySection?.classList.remove('hidden');
            recipesSection?.classList.remove('hidden');
            detailsSection?.classList.add('hidden');
        } else {
            searchSection?.classList.add('hidden');
            categorySection?.classList.add('hidden');
            recipesSection?.classList.add('hidden');
            detailsSection?.classList.remove('hidden');
        }
    }
    //*============================================
    showMealDetailsById(id) {
        const detailsContainer = document.querySelector('#meal-details .max-w-7xl');
        if (!detailsContainer) return;

        detailsContainer.innerHTML = `
        <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
        `;

        this.toggleMainComponents(false);

        this.app.api.getMealDetails(id).then(meal => {
            if (meal) {
                this.renderMealDetailsPage(meal);
            }
        }).catch(err => {
            console.error(err);
            detailsContainer.innerHTML = `<p class="text-center text-red-500 w-full">Failed to load details.</p>`;
        });
    }
    //*==================================================
    getIngredientsArray(meal) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            const measure = meal[`strMeasure${i}`];

            if (ingredient && ingredient.trim() !== "") {
                ingredients.push({
                    name: ingredient.trim(),
                    measure: measure ? measure.trim() : ""
                });
            }
        }
        return ingredients;
    }
    //*==================================================
    getYoutubeEmbedUrl(url) {
        if (!url) return "";
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : "";
    }
    //*==================================================
    //*==================================================
    //* Render Meal Details Page Inside #meal-details WITH REAL API
    async renderMealDetailsPage(meal) {
        const detailsSection = document.getElementById('meal-details');
        if (!detailsSection) return;

        const ingredients = this.getIngredientsArray(meal);
        const youtubeUrl = this.getYoutubeEmbedUrl(meal.strYoutube);

        const ingredientsQueryArray = ingredients.map(ing => `${ing.measure} ${ing.name}`);

        const ingredientsHtml = ingredients.map(ing => `
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors">
                <input
                    type="checkbox"
                    class="ingredient-checkbox w-5 h-5 text-emerald-600 rounded border-gray-300"
                />
                <span class="text-gray-700">
                    <span class="font-medium text-gray-900">${ing.measure}</span> ${ing.name}
                </span>
            </div>
        `).join('');

        const instructionsSteps = meal.strInstructions ? meal.strInstructions.split(/\r?\n|\./).filter(step => step !== '' && !/^\d+\s*\.?\s*$/.test(step)) : [];

        const instructionsHtml = instructionsSteps.map((step, index) => `
            <div class="flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div class="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    ${index + 1}
                </div>
                <p class="text-gray-700 leading-relaxed pt-2">
                    ${step.trim()}.
                </p>
            </div>
        `).join('');

        detailsSection.innerHTML = `    
        <div class="max-w-7xl mx-auto">
            <button
                id="back-to-recipes-btn"
                class="flex items-center gap-2 text-gray-600 hover:text-emerald-600 font-medium mb-6 transition-colors cursor-pointer">
                <i class="fa-solid fa-arrow-left"></i>
                <span>Back to Recipes</span>
            </button>
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
                <div class="relative h-80 md:h-96">
                    <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-8">
                        <div class="flex items-center gap-3 mb-3">
                            ${meal.strCategory ? `<span class="px-3 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">${meal.strCategory}</span>` : ''}
                            ${meal.strArea ? `<span class="px-3 py-1 bg-blue-500 text-white text-sm font-semibold rounded-full">${meal.strArea}</span>` : ''}
                            ${meal.strTags ? meal.strTags.split(',').slice(0, 1).map(tag => `<span class="px-3 py-1 bg-purple-500 text-white text-sm font-semibold rounded-full">${tag.trim()}</span>`).join('') : ''}
                        </div>
                        <h1 class="text-3xl md:text-4xl font-bold text-white mb-2">${meal.strMeal}</h1>
                        <div class="flex items-center gap-6 text-white/90">
                            <span class="flex items-center gap-2"><i class="fa-solid fa-clock"></i><span>30 min</span></span>
                            <span class="flex items-center gap-2"><i class="fa-solid fa-utensils"></i><span id="hero-servings">4 servings</span></span>
                            <span class="flex items-center gap-2"><span id="hero-calories">Calculating...</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- زرار الـ Log هيفضل معطل ومكتوب عليه Calculating لحد ما الـ API يرد -->
            <div class="flex flex-wrap gap-3 mb-8">
                <button
                    id="log-meal-btn"
                    class="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-500 rounded-xl font-semibold transition-all cursor-not-allowed"
                    data-meal-id="${meal.idMeal}" disabled>
                    <i class="fa-solid fa-circle-notch animate-spin"></i>
                    <span>Calculating Nutrition...</span>
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-8">
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-list-check text-emerald-600"></i>Ingredients
                            <span class="text-sm font-normal text-gray-500 ml-auto">${ingredients.length} items</span>
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${ingredientsHtml}</div>
                    </div>

                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-shoe-prints text-emerald-600"></i>Instructions
                        </h2>
                        <div class="space-y-4">${instructionsHtml}</div>
                    </div>

                    ${youtubeUrl ? `
                    <div class="bg-white rounded-2xl shadow-lg p-6">
                        <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-video text-red-500"></i>Video Tutorial</h2>
                        <div class="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                            <iframe src="${youtubeUrl}" class="absolute inset-0 w-full h-full" frameborder="0" allowfullscreen></iframe>
                        </div>
                    </div>` : ''}
                </div>

                <div class="space-y-6">
                    <div class="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
                        <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><i class="fa-solid fa-chart-pie text-emerald-600"></i>Nutrition Facts</h2>
                        <div id="nutrition-facts-container">
                            <!-- مؤشر الـ Loading الذكي -->
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-4 animate-bounce">
                                    <i class="fa-solid fa-calculator text-3xl"></i>
                                </div>
                                <h3 class="font-bold text-gray-800 text-lg">Analyzing Recipe</h3>
                                <p class="text-sm text-gray-500 mb-3">Fetching real-time nutrition data...</p>
                                <div class="flex space-x-1 justify-center">
                                    <div class="h-2 w-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div class="h-2 w-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div class="h-2 w-2 bg-emerald-600 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

        try {
            const apiResponse = await this.app.api.getNutritionAnalysis(meal.strMeal, ingredientsQueryArray);
            console.log("Real API Response:", apiResponse);

            const nutrition = apiResponse?.data?.perServing ? apiResponse.data.perServing : null;

            const finalNutrition = nutrition || {
                calories: 540, protein: 32, carbs: 65, fat: 14, fiber: 5, sugar: 3,
                vitamins: { vitaminA: 15, vitaminC: 20, calcium: 10, iron: 15 }
            };

            const servings = 4;
            const generatedCalories = Math.round(finalNutrition.calories || 0);
            const generatedProtein = Math.round(finalNutrition.protein || 0);
            const generatedCarbs = Math.round(finalNutrition.carbs || 0);
            const generatedFat = Math.round(finalNutrition.fat || 0);
            const generatedFiber = Math.round(finalNutrition.fiber || 0);
            const generatedSugar = Math.round(finalNutrition.sugar || 0);

            const generatedCholesterol = Math.round(finalNutrition.cholesterol || 0);
            const generatedSodium = Math.round(finalNutrition.sodium || 0);
            const generatedSatFat = Math.round(finalNutrition.saturatedFat || 0);

            const heroCalories = document.getElementById('hero-calories');
            if (heroCalories) {
                heroCalories.innerHTML = `<i class="fa-solid fa-fire"></i> <span>${generatedCalories} cal/serving</span>`;
            }

            const logMealBtn = document.getElementById('log-meal-btn');
            if (logMealBtn) {
                logMealBtn.disabled = false;
                logMealBtn.className = "flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all cursor-pointer";
                logMealBtn.innerHTML = `<i class="fa-solid fa-clipboard-list"></i> <span>Log This Meal</span>`;

                logMealBtn.removeEventListener('click', this._logMealHandler);
                this._logMealHandler = () => {
                    this.currentActiveMeal = meal;
                    this.app.state.currentModalServings = 1;
                    this.app.state.currentMealNutrition = {
                        calories: generatedCalories,
                        protein: generatedProtein,
                        carbs: generatedCarbs,
                        fat: generatedFat
                    };

                    document.getElementById('modal-meal-img').src = meal.strMealThumb;
                    document.getElementById('modal-meal-img').alt = meal.strMeal;
                    document.getElementById('modal-meal-name').innerText = meal.strMeal;

                    this.updateModalNutritionDOM();
                    document.getElementById('log-meal-modal').classList.remove('hidden');
                };
                logMealBtn.addEventListener('click', this._logMealHandler);
            }

            const nutritionContainer = document.getElementById('nutrition-facts-container');
            if (nutritionContainer) {
                nutritionContainer.innerHTML = `
    <p class="text-sm text-gray-500 mb-4">Per serving</p>
    <div class="text-center py-4 mb-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
        <p class="text-sm text-gray-600">Calories per serving</p>
        <p class="text-4xl font-bold text-emerald-600">${generatedCalories}</p>
        <p class="text-xs text-gray-500 mt-1">Total: ${generatedCalories * servings} cal</p>
    </div>

    <div class="space-y-3">
    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-emerald-500"></div><span class="text-sm text-gray-700">Protein</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedProtein}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-emerald-500 h-2 rounded-full" style="width: ${Math.min((generatedProtein / 50) * 100, 100)}%"></div>
        </div>
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-blue-500"></div><span class="text-sm text-gray-700">Carbs</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedCarbs}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full" style="width: ${Math.min((generatedCarbs / 100) * 100, 100)}%"></div>
        </div>
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-purple-500"></div><span class="text-sm text-gray-700">Fat</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedFat}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-purple-500 h-2 rounded-full" style="width: ${Math.min((generatedFat / 50) * 100, 100)}%"></div>
        </div>
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-orange-500"></div><span class="text-sm text-gray-700">Fiber</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedFiber}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-orange-500 h-2 rounded-full" style="width: ${Math.min((generatedFiber / 30) * 100, 100)}%"></div>
        </div>
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-pink-500"></div><span class="text-sm text-gray-700">Sugar</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedSugar}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-pink-500 h-2 rounded-full" style="width: ${Math.min((generatedSugar / 50) * 100, 100)}%"></div>
        </div>
    </div>

    <div>
        <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-red-500"></div><span class="text-sm text-gray-700">Saturated Fat</span></div>
            <span class="text-sm font-bold text-gray-900">${generatedSatFat}g</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-red-500 h-2 rounded-full" style="width: ${Math.min((generatedSatFat / 20) * 100, 100)}%"></div>
        </div>
    </div>
</div>

    <div class="mt-5 pt-4 border-t border-gray-100">
        <p class="text-xs font-semibold text-gray-500 mb-3">Other</p>
        <div class="flex gap-6">
            <div>
                <span class="text-xs text-gray-500">Cholesterol</span>
                <span class="text-xs font-bold text-gray-900 ml-1">${generatedCholesterol}mg</span>
            </div>
            <div>
                <span class="text-xs text-gray-500">Sodium</span>
                <span class="text-xs font-bold text-gray-900 ml-1">${generatedSodium}mg</span>
            </div>
        </div>
    </div>
`;
            }

        } catch (err) {
            console.error("Error analyzing nutrition via real API:", err);
            const nutritionContainer = document.getElementById('nutrition-facts-container');
            if (nutritionContainer) {
                nutritionContainer.innerHTML = `<p class="text-center text-red-500 py-6">Unable to load nutrition insights at this moment.</p>`;
            }
        }


    }

    //*====================================================
    updateModalNutritionDOM() {
        const state = this.app.state;
        const servings = state.currentModalServings;
        const base = state.currentMealNutrition;

        if (!base) return;

        document.getElementById('input-servings').value = servings;
        document.getElementById('modal-cal').innerText = Math.round(base.calories * servings);
        document.getElementById('modal-protein').innerText = Math.round(base.protein * servings) + 'g';
        document.getElementById('modal-carbs').innerText = Math.round(base.carbs * servings) + 'g';
        document.getElementById('modal-fat').innerText = Math.round(base.fat * servings) + 'g';
    }
    //*===================================================
    renderFoodLog() {

        const dateElement = document.getElementById('foodlog-date');
        if (dateElement) {
            const today = new Date();

            const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
            const monthName = today.toLocaleDateString('en-US', { month: 'short' });
            const dayNumber = today.getDate();

            dateElement.innerText = `${dayName}, ${monthName} ${dayNumber}`;
        }

        let loggedItems = [];
        try {
            const localData = localStorage.getItem('foodLog');
            loggedItems = localData ? JSON.parse(localData) : [];
        } catch (e) {
            console.error("خطأ في قراءة الـ LocalStorage:", e);
            loggedItems = this.app?.state?.loggedItems || [];
        }


        const itemsListContainer = document.getElementById('logged-items-list');
        const clearAllBtn = document.getElementById('clear-foodlog');
        const totalItemsHeader = document.querySelector('#foodlog-today-section h4');

        if (!itemsListContainer) {
            console.error("لم نجد عنصر logged-items-list في الـ HTML! تأكد من وجوده.");
            return;
        }

        const goals = { calories: 2000, protein: 50, carbs: 250, fat: 65 };
        let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        loggedItems.forEach(item => {
            totals.calories += Number(item.calories || 0);
            totals.protein += Number(item.protein || 0);
            totals.carbs += Number(item.carbs || 0);
            totals.fat += Number(item.fat || 0);
        });

        this.updateProgressBar('Calories', totals.calories, goals.calories, 'kcal');
        this.updateProgressBar('Protein', totals.protein, goals.protein, 'g');
        this.updateProgressBar('Carbs', totals.carbs, goals.carbs, 'g');
        this.updateProgressBar('Fat', totals.fat, goals.fat, 'g');

        if (totalItemsHeader) {
            totalItemsHeader.innerText = `Logged Items (${loggedItems.length})`;
        }

        if (clearAllBtn) {
            clearAllBtn.style.display = loggedItems.length > 0 ? 'block' : 'none';
        }

        if (loggedItems.length === 0) {
            itemsListContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
              <i class="fa-solid fa-utensils text-4xl mb-3 text-gray-300"></i>
              <p class="font-medium">No meals logged today</p>
              <p class="text-sm">Add meals from the Meals page or scan products</p>
            </div>
        `;
        } else {
            itemsListContainer.innerHTML = loggedItems.map((item, index) => `
            <div class="flex flex-wrap items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100">
                <div class="flex items-center gap-4">
                    <img src="${item.image || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=150'}" alt="${item.name}" class="w-12 h-12 rounded-xl object-cover border border-gray-200">
                    <div>
                            <h5 class="font-bold text-gray-900">${item.name}</h5>
                        <p class="text-xs text-gray-500">${item.servings || 1} serving${(item.servings || 1) > 1 ? 's' : ''} • <span class="text-emerald-600 font-medium cursor-pointer">Recipe</span></p>
                        <p class="text-[10px] text-gray-400 mt-0.5">${item.time || '12:00 AM'}</p> 
                    </div>
                </div>
                
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <span class="text-lg font-extrabold text-emerald-600">${Math.round(item.calories)}</span>
                        <span class="text-xs text-gray-500 block -mt-1">kcal</span>
                    </div>
                    <div class="flex gap-1.5 text-xs text-gray-600">
                        <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">${Math.round(item.protein)}g P</span>
                        <span class="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">${Math.round(item.carbs)}g C</span>
                        <span class="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">${Math.round(item.fat)}g F</span>
                    </div>
                    <button class="delete-logged-item text-gray-400 hover:text-red-500 transition-colors p-1" data-index="${index}">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        `).join('');

            this.initDeleteEvents();
            this.renderWeeklyOverview();
        }
    }
    //*===================================================
    updateProgressBar(type, current, goal, unit) {
        const targetCard = document.querySelector(`#foodlog-today-section [data-type="${type}"]`);
        if (!targetCard) return;

        const textElement = targetCard.querySelector('.progress-text');
        if (textElement) textElement.innerText = `${Math.round(current)} / ${goal} ${unit}`;

        const percentage = Math.min((current / goal) * 100, 100);
        const progressBar = targetCard.querySelector('.progress-bar-fill');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;

            if (current > goal) {
                progressBar.classList.remove('bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500');
                progressBar.classList.add('bg-red-500');
            }
        }
    }
    //*===================================================
    initDeleteEvents() {
        document.querySelectorAll('.delete-logged-item').forEach(btn => {
            btn.onclick = (e) => {
                const index = e.currentTarget.dataset.index;

                let currentLog = JSON.parse(localStorage.getItem('foodLog')) || [];

                currentLog.splice(index, 1);

                localStorage.setItem('foodLog', JSON.stringify(currentLog));
                if (this.app?.state) {
                    this.app.state.loggedItems = currentLog;
                }

                this.archivePreviousDay();
                this.renderFoodLog();
                this.renderWeeklyOverview();

                this.showToast("Item removed from log");
            };
        });
        //*========================

    }
    //*=========================================================
    showToast(message) {
        Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'success',
            iconColor: '#A5DB85',
            title: `<span class="text-sm font-semibold text-gray-800">${message}</span>`,
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
            customClass: {
                popup: 'rounded-xl p-4 shadow-xl border border-gray-100 bg-white'
            }
        });
    }
    //*==================================================================
    renderWeeklyOverview() {
        console.log("تحديث الـ Weekly Overview عبر ID...");

        const weeklyContainer = document.getElementById('weekly-chart');
        if (!weeklyContainer) {
            console.warn("Weekly chart container not found!");
            return;
        }

        const loggedItems = JSON.parse(localStorage.getItem('foodLog')) || [];
        let weeklySummary = JSON.parse(localStorage.getItem('weeklySummary')) || {};
        const todayStr = new Date().toLocaleDateString('en-US');

        let todayCalories = loggedItems.reduce((sum, item) => sum + Math.round(Number(item.calories || 0)), 0);
        weeklySummary[todayStr] = {
            calories: todayCalories,
            itemsCount: loggedItems.length
        };
        localStorage.setItem('weeklySummary', JSON.stringify(weeklySummary));

        const current = new Date();
        const mondayDate = new Date(current);
        mondayDate.setDate(current.getDate() - (current.getDay() === 0 ? 6 : current.getDay() - 1));

        let htmlContent = '';
        const daysNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        for (let i = 0; i < 7; i++) {
            const d = new Date(mondayDate);
            d.setDate(mondayDate.getDate() + i);
            const dateStr = d.toLocaleDateString('en-US');
            const isToday = d.toDateString() === current.toDateString();
            const data = weeklySummary[dateStr] || { calories: 0, itemsCount: 0 };

            htmlContent += `
            <div class="flex flex-col items-center justify-between flex-1 py-4 px-2 rounded-2xl transition-all ${isToday ? 'bg-blue-50/70 border border-blue-200' : ''}">
                <span class="text-xs font-medium text-gray-400">${daysNames[i]}</span>
                <span class="text-base font-bold text-gray-900 my-1.5">${d.getDate()}</span>
                <div class="text-center">
                    <span class="block text-base ${data.calories > 0 ? 'text-emerald-600 font-bold' : 'text-gray-300'}">${data.calories}</span>
                    <span class="block text-[10px] text-gray-400 -mt-1">kcal</span>
                    ${data.calories > 0 ? `<span class="block text-[11px] text-gray-400 mt-0.5 font-medium">${data.itemsCount} item${data.itemsCount > 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>`;
        }

        weeklyContainer.className = "flex items-stretch justify-between p-2 bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[140px]";
        weeklyContainer.innerHTML = htmlContent;
    }
    //*==============================================================
    archivePreviousDay() {
        const todayStr = new Date().toLocaleDateString('en-US');
        const lastVisitDate = localStorage.getItem('lastVisitDate');

        if (!lastVisitDate) {
            localStorage.setItem('lastVisitDate', todayStr);
            return;
        }

        if (lastVisitDate !== todayStr) {
            const previousLog = JSON.parse(localStorage.getItem('foodLog')) || [];
            const previousCalories = previousLog.reduce((sum, item) => sum + Math.round(Number(item.calories || 0)), 0);

            let weeklySummary = JSON.parse(localStorage.getItem('weeklySummary')) || {};


            weeklySummary[lastVisitDate] = {
                calories: previousCalories,
                itemsCount: previousLog.length,
                log: previousLog
            };
            localStorage.setItem('weeklySummary', JSON.stringify(weeklySummary));

            const todayData = weeklySummary[todayStr];
            if (todayData && todayData.log) {
                localStorage.setItem('foodLog', JSON.stringify(todayData.log));
            } else {
                localStorage.setItem('foodLog', JSON.stringify([]));
            }

            localStorage.setItem('lastVisitDate', todayStr);
            location.reload();
        }
    }
    //*=============================================================
    //* Single entry point for the Products page: combines the current
    //* search text + selected Nutri-Score grade, then renders results.
    async runProductSearch() {
        const { query, grade } = this.productSearchState;
        const grid = document.getElementById('products-grid');
        const resultsLabel = document.getElementById('products-results-label');

        if (!query && !grade) {
            if (resultsLabel) resultsLabel.textContent = 'Search for products to see results';
            if (grid) {
                grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-box-open text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 font-medium">No products to display</p>
                <p class="text-gray-400 text-sm mt-1">Search for a product or browse by category</p>
            </div>
        `;
            }
            return;
        }

        if (grid) {
            grid.innerHTML = `<div class="flex items-center justify-center py-12 col-span-full"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>`;
        }

        const { results, total } = await this.app.api.searchProducts(query, grade);

        const filteredResults = grade
            ? results.filter(p => (p.nutritionGrade || '').toLowerCase() === grade.toLowerCase())
            : results;

        if (resultsLabel) {
            const queryPart = query ? ` for "${query}"` : '';
            if (grade) {
                resultsLabel.textContent = `Found ${filteredResults.length}${filteredResults.length === 1 ? ' product' : ' products'}${queryPart} with Nutri-Score ${grade.toUpperCase()} (on this page)`;
            } else {
                resultsLabel.textContent = `Found ${total}${total === 1 ? ' product' : ' products'}${queryPart}`;
            }
        }

        if (grade && filteredResults.length === 0) {
            if (grid) {
                grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-magnifying-glass text-gray-400 text-2xl"></i>
                </div>
                <p class="text-gray-500 font-medium">No Nutri-Score ${grade.toUpperCase()} products found on this page</p>
                <p class="text-gray-400 text-sm mt-1">Try a different search term or browse another category</p>
            </div>
        `;
            }
            return;
        }

        this.renderProducts(filteredResults);
    }
    //*=============================================================
    renderProducts(products) {
        const container = document.getElementById('products-grid');
        container.innerHTML = '';

        if (!products || products.length === 0) {
            container.innerHTML = '<p class="text-center w-full col-span-3 text-gray-500 py-8">No products found.</p>';
            return;
        }

        const nutriScoreColors = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', UNKNOWN: '#6b7280' };

        products.forEach(product => {
            const name = product.name || 'Unknown Product';
            const brand = product.brand || 'Unknown Brand';
            const image = product.image || 'https://via.placeholder.com/150';
            const nutrients = product.nutrients || {};
            const score = (product.nutritionGrade || 'unknown').toUpperCase();
            const scoreColor = nutriScoreColors[score] || nutriScoreColors.UNKNOWN;
            const nova = product.novaGroup || '1';

            const cardHTML = `
        <div class="product-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group" data-barcode="${product.barcode}">
            <div class="relative h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" 
                     src="${image}" alt="${name}" loading="lazy" />
                <div class="absolute top-2 left-2 text-white text-xs font-bold px-2 py-1 rounded uppercase" style="background-color: ${scoreColor}">
                    Nutri-Score ${score}
                </div>
                <div class="absolute top-2 right-2 bg-lime-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    ${nova}
                </div>
            </div>
            <div class="p-4">
                <p class="text-xs text-emerald-600 font-semibold mb-1 truncate">${brand}</p>
                <h3 class="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">${name}</h3>
                <div class="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span><i class="fa-solid fa-fire mr-1"></i>${Math.round(nutrients.calories || 0)} kcal/100g</span>
                </div>
                <div class="grid grid-cols-4 gap-1 text-center">
                    <div class="bg-emerald-50 rounded p-1.5"><p class="text-xs font-bold text-emerald-700">${Math.round(nutrients.protein || 0)}g</p><p class="text-[10px] text-gray-500">Protein</p></div>
                    <div class="bg-blue-50 rounded p-1.5"><p class="text-xs font-bold text-blue-700">${Math.round(nutrients.carbs || 0)}g</p><p class="text-[10px] text-gray-500">Carbs</p></div>
                    <div class="bg-purple-50 rounded p-1.5"><p class="text-xs font-bold text-purple-700">${Math.round(nutrients.fat || 0)}g</p><p class="text-[10px] text-gray-500">Fat</p></div>
                    <div class="bg-orange-50 rounded p-1.5"><p class="text-xs font-bold text-orange-700">${Math.round(nutrients.sugar || 0)}g</p><p class="text-[10px] text-gray-500">Sugar</p></div>
                </div>
            </div>
        </div>`;

            container.insertAdjacentHTML('beforeend', cardHTML);
            container.querySelectorAll('.product-card').forEach(card => {
                card.onclick = () => {
                    const barcode = card.getAttribute('data-barcode');
                    const product = products.find(p => p.barcode == barcode);
                    if (product) this.showProductModal(product);
                };
            });
        });
    }
    //*================================================================
    renderProductCategories(categories) {
        const container = document.getElementById('product-categories');
        if (!container) return;

        const icons = {
            snacks: 'fa-cookie',
            beverages: 'fa-glass-water',
            dairies: 'fa-cheese',
            cheeses: 'fa-cheese',
            yogurts: 'fa-jar',
            chocolates: 'fa-candy-bar',
            biscuits: 'fa-cookie-bite',
            'ice-creams': 'fa-ice-cream',
            'breakfast-cereals': 'fa-wheat-awn',
            breads: 'fa-bread-slice',
            waters: 'fa-droplet',
            sodas: 'fa-bottle-water',
            fruits: 'fa-apple-whole',
            vegetables: 'fa-carrot',
            meats: 'fa-drumstick-bite',
            'fish-and-seafood': 'fa-fish',
            'plant-based-foods': 'fa-leaf',
            sauces: 'fa-jar',
            spreads: 'fa-bread-slice',
            pasta: 'fa-bowl-food',
            desserts: 'fa-ice-cream',
            coffees: 'fa-mug-hot',
            teas: 'fa-mug-saucer',
        };

        const colors = [
            'linear-gradient(135deg, #f97316, #ea580c)',
            'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            'linear-gradient(135deg, #a855f7, #7c3aed)',
            'linear-gradient(135deg, #06b6d4, #0891b2)',
            'linear-gradient(135deg, #ef4444, #dc2626)',
            'linear-gradient(135deg, #22c55e, #16a34a)',
            'linear-gradient(135deg, #f59e0b, #d97706)',
            'linear-gradient(135deg, #ec4899, #db2777)',
            'linear-gradient(135deg, #14b8a6, #0d9488)',
            'linear-gradient(135deg, #6366f1, #4f46e5)',
        ];

        container.innerHTML = categories.map((cat, i) => {
            const icon = icons[cat.id] || 'fa-tag';
            const gradient = colors[i % colors.length];
            return `
            <button class="product-category-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all text-white" 
                    style="background: ${gradient}" 
                    data-category="${cat.id}">
                <i class="fa-solid ${icon}"></i>${cat.name}
            </button>
        `;
        }).join('');

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('.product-category-btn');
            if (!btn) return;

            const category = btn.getAttribute('data-category');
            const grid = document.getElementById('products-grid');
            const resultsLabel = document.getElementById('products-results-label');

            grid.innerHTML = `<div class="flex items-center justify-center py-12 col-span-full"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>`;

            const products = await this.app.api.getProductsByCategory(category);
            if (resultsLabel) resultsLabel.textContent = `Results for: ${btn.textContent.trim()}`;
            this.renderProducts(products);
        });
    }
    //*====================================================================
    showProductModal(product) {
        const modal = document.getElementById('product-modal');
        const nutriScoreColors = { a: '#22c55e', b: '#84cc16', c: '#eab308', d: '#f97316', e: '#ef4444', unknown: '#6b7280' };
        const nutriScoreDescriptions = { a: 'Excellent', b: 'Good', c: 'Fair', d: 'Poor', e: 'Bad', unknown: 'Not available' };
        const novaColors = { 1: '#22c55e', 2: '#84cc16', 3: '#f97316', 4: '#ef4444' };
        const novaDescriptions = { 1: 'Unprocessed', 2: 'Processed culinary', 3: 'Processed', 4: 'Ultra-processed' };

        const score = (product.nutritionGrade || 'unknown').toLowerCase();
        const novaGroup = product.novaGroup || '';
        const nutrients = product.nutrients || {};

        document.getElementById('modal-product-img').src = product.image || '';
        document.getElementById('modal-product-brand').textContent = product.brand || '';
        document.getElementById('modal-product-name').textContent = product.name || '';
        document.getElementById('modal-product-quantity').textContent = product.quantity || '';

        const nutriColor = nutriScoreColors[score] || nutriScoreColors.unknown;
        const nutriWrapper = document.getElementById('modal-nutri-score-wrapper');
        if (nutriWrapper) nutriWrapper.style.backgroundColor = `${nutriColor}20`;
        document.getElementById('modal-nutri-score-badge').textContent = score.toUpperCase();
        document.getElementById('modal-nutri-score-badge').style.backgroundColor = nutriColor;
        document.getElementById('modal-nutri-score-label').style.color = nutriColor;
        document.getElementById('modal-nutri-score-desc').textContent = nutriScoreDescriptions[score] || nutriScoreDescriptions.unknown;

        const novaColor = novaColors[novaGroup] || '#6b7280';
        const novaWrapper = document.getElementById('modal-nova-wrapper');
        if (novaWrapper) novaWrapper.style.backgroundColor = `${novaColor}20`;
        document.getElementById('modal-nova-badge').textContent = novaGroup || '?';
        document.getElementById('modal-nova-badge').style.backgroundColor = novaColor;
        document.getElementById('modal-nova-label').style.color = novaColor;
        document.getElementById('modal-nova-desc').textContent = novaDescriptions[novaGroup] || 'Not available';

        const cal = Math.round(nutrients.calories || 0);
        const protein = Math.round(nutrients.protein || 0);
        const carbs = Math.round(nutrients.carbs || 0);
        const fat = Math.round(nutrients.fat || 0);
        const sugar = Math.round(nutrients.sugar || 0);
        const satfat = Math.round(nutrients.saturatedFat || 0);
        const fiber = Math.round(nutrients.fiber || 0);
        const salt = (nutrients.salt || 0).toFixed(2);

        document.getElementById('modal-calories').textContent = cal;
        document.getElementById('modal-protein-val').textContent = `${protein}g`;
        document.getElementById('modal-carbs-val').textContent = `${carbs}g`;
        document.getElementById('modal-fat-val').textContent = `${fat}g`;
        document.getElementById('modal-sugar-val').textContent = `${sugar}g`;
        document.getElementById('modal-satfat-val').textContent = `${satfat}g`;
        document.getElementById('modal-fiber-val').textContent = `${fiber}g`;
        document.getElementById('modal-salt-val').textContent = `${salt}g`;

        document.getElementById('modal-protein-bar').style.width = `${Math.min((protein / 50) * 100, 100)}%`;
        document.getElementById('modal-carbs-bar').style.width = `${Math.min((carbs / 100) * 100, 100)}%`;
        document.getElementById('modal-fat-bar').style.width = `${Math.min((fat / 50) * 100, 100)}%`;
        document.getElementById('modal-sugar-bar').style.width = `${Math.min((sugar / 50) * 100, 100)}%`;

        const ingredientsSection = document.getElementById('modal-ingredients-section');
        const ingredientsText = document.getElementById('modal-ingredients-text');
        if (ingredientsSection && ingredientsText) {
            const ingredients = product.ingredients;
            let ingredientsStr = '';
            if (Array.isArray(ingredients)) {
                ingredientsStr = ingredients.join(', ');
            } else if (typeof ingredients === 'string') {
                ingredientsStr = ingredients.trim();
            }

            if (ingredientsStr) {
                ingredientsText.textContent = ingredientsStr;
                ingredientsSection.classList.remove('hidden');
            } else {
                ingredientsSection.classList.add('hidden');
            }
        }

        const allergensSection = document.getElementById('modal-allergens-section');
        const allergensText = document.getElementById('modal-allergens-text');
        if (allergensSection && allergensText) {
            const allergens = product.allergens;
            let allergensStr = '';
            if (Array.isArray(allergens)) {
                allergensStr = allergens.join(', ');
            } else if (typeof allergens === 'string') {
                allergensStr = allergens.trim();
            }

            if (allergensStr) {
                allergensText.textContent = allergensStr;
                allergensSection.classList.remove('hidden');
            } else {
                allergensSection.classList.add('hidden');
            }
        }

        // Log button
        const logBtn = document.getElementById('modal-log-product-btn');
        logBtn.onclick = () => {
            const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const loggedProduct = {
                id: Date.now(),
                name: product.name,
                image: product.image || '',
                brand: product.brand || '',
                servings: 1,
                calories: cal,
                protein: protein,
                carbs: carbs,
                fat: fat,
                date: new Date().toLocaleDateString(),
                time: currentTime,
                type: 'product'
            };

            let foodLog = JSON.parse(localStorage.getItem('foodLog')) || [];
            foodLog.push(loggedProduct);
            localStorage.setItem('foodLog', JSON.stringify(foodLog));

            if (this.app?.state) this.app.state.loggedItems = foodLog;

            modal.classList.add('hidden');
            this.renderFoodLog();
            this.renderWeeklyOverview();

            this.showToast(`${product.name} logged to your daily intake! 📋`);
        };

        // Close buttons
        document.getElementById('close-product-modal').onclick = () => modal.classList.add('hidden');
        document.getElementById('close-product-modal-2').onclick = () => modal.classList.add('hidden');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

        modal.classList.remove('hidden');
    }
}