export class mealApi {
    /**
     * Initializes the base URL for TheMealDB API.
     */
    constructor() {
        this.baseUrl = "https://www.themealdb.com/api/json/v1/1/"
    }

    /**
     * Fetches all available meal categories.
     */
    async getCategories() {
        try {
            const response = await fetch(`${this.baseUrl}categories.php`);
            const dataOfCategories = await response.json();
            console.log(dataOfCategories.categories, "All Categories   ")
            return dataOfCategories.categories;
        } catch (error) {
            console.error("Error fetching categories:", error);
            return [];
        }
    }

    /**
     * Searches for meals by name matching the query.
     */
    async searchMeals(query) {
        try {
            const response = await fetch(`${this.baseUrl}search.php?s=${query}`);
            const dataOfsearch = await response.json()
            console.log(dataOfsearch.meals, "(search)")
            return dataOfsearch.meals;
        } catch (error) {
            console.error("Error fetching searchMeals:", error);
            return [];
        }
    }

    /**
     * Filters meals belonging to a specific category name.
     */
    async filterByCategory(categoryName) {
        try {
            const response = await fetch(`${this.baseUrl}filter.php?c=${categoryName}`);
            const dataOfCategoryName = await response.json();
            console.log(dataOfCategoryName.meals, "(Filter by CategoryName)")
            return dataOfCategoryName.meals;
        } catch (error) {
            console.error("Error fetching categoryName:", error);
            return [];
        }
    }

    /**
     * Fetches details of a specific meal using its unique ID.
     */
    async getMealDetails(id) {
        try {
            const response = await fetch(`${this.baseUrl}lookup.php?i=${id}`);
            const data = await response.json();
            return data.meals ? data.meals[0] : null;
        } catch (error) {
            console.error("Error fetching meal details:", error);
            return null;
        }
    }

    /**
     * Filters meals based on their geographic area/cuisine.
     */
    async filterByArea(areaName) {
        try {
            const response = await fetch(`${this.baseUrl}filter.php?a=${areaName}`);
            const data = await response.json();
            return data.meals || [];
        } catch (error) {
            console.error("Error filtering by area:", error);
            return [];
        }
    }

    /**
     * Fetches a single random meal profile.
     */
    async getRandomMeal() {
        try {
            const response = await fetch(`${this.baseUrl}random.php`);
            const data = await response.json();
            return data.meals ? data.meals[0] : null;
        } catch (error) {
            console.error("Error fetching random meal:", error);
            return null;
        }
    }

    /**
     * Fetches the complete list of available areas/cuisines.
     */
    async getCuisines() {
        try {
            const response = await fetch(`${this.baseUrl}list.php?a=list`);
            const dataOfCuisines = await response.json();
            console.log(dataOfCuisines.meals, "All Cuisines");
            return dataOfCuisines.meals || [];
        } catch (error) {
            console.error("Error fetching cuisines:", error);
            return [];
        }
    }

    /**
     * Analyzes recipe ingredients to retrieve nutritional summary data.
     */
    async getNutritionAnalysis(mealName, ingredients) {
        try {
            const response = await fetch(`https://nutriplan-api.vercel.app/api/nutrition/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 's2prrNMxNrM7Lf1alifWK8cimpOdssSxn3VKmAg7'
                },
                body: JSON.stringify({
                    recipeName: mealName,
                    ingredients: ingredients
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Status:", response.status);
                console.error("Server Message:", errorData);
                return null;
            }

            const data = await response.json();
            console.log("النتيجة:", data);
            return data;
        } catch (error) {
            console.error("Critical Fetch Error:", error);
            return null;
        }
    }

    /**
     * Searches for products with optional filtering by nutrition grade.
     */
    async searchProducts(query, grade = '') {
        try {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            if (grade) params.set('nutritionGrade', grade);

            const url = `https://nutriplan-api.vercel.app/api/products/search?${params.toString()}`;

            const response = await fetch(url, {
                headers: { 'x-api-key': 's2prrNMxNrM7Lf1alifWK8cimpOdssSxn3VKmAg7' }
            });
            const data = await response.json();
            return {
                results: data.results || [],
                total: typeof data.total === 'number' ? data.total : (data.results ? data.results.length : 0)
            };
        } catch (error) {
            console.error("Error fetching products:", error);
            return { results: [], total: 0 };
        }
    }

    /**
     * Retrieves specific product information via its barcode value.
     */
    async getProductByBarcode(barcode) {
        try {
            const response = await fetch(
                `https://nutriplan-api.vercel.app/api/products/barcode/${barcode}`,
                {
                    headers: {
                        'x-api-key': 's2prrNMxNrM7Lf1alifWK8cimpOdssSxn3VKmAg7'
                    }
                }
            );

            if (!response.ok) {
                console.error("Barcode API Error:", response.status);
                return null;
            }

            const data = await response.json();
            console.log("Barcode Response:", data);
            return data;
        } catch (error) {
            console.error("Error fetching barcode:", error);
            return null;
        }
    }

    /**
     * Fetches the complete classification directory of product categories.
     */
    async getProductCategories() {
        try {
            const response = await fetch(
                `https://nutriplan-api.vercel.app/api/products/categories`,
                { headers: { 'x-api-key': 's2prrNMxNrM7Lf1alifWK8cimpOdssSxn3VKmAg7' } }
            );
            const data = await response.json();
            console.log("Categories:", data);
            return data.categories || data.results || data || [];
        } catch (error) {
            console.error("Error fetching categories:", error);
            return [];
        }
    }

    /**
     * Queries and brings back all products belonging to a targeted category.
     */
    async getProductsByCategory(category) {
        try {
            const response = await fetch(
                `https://nutriplan-api.vercel.app/api/products/category/${category}`,
                {
                    headers: {
                        'x-api-key': 's2prrNMxNrM7Lf1alifWK8cimpOdssSxn3VKmAg7'
                    }
                }
            );
            const data = await response.json();
            console.log("Products by category:", data);
            return data.results || [];
        } catch (error) {
            console.error("Error fetching products by category:", error);
            return [];
        }
    }
}