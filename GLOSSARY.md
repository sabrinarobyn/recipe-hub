# Recipe Hub

A shared recipe book for friends and family, with private meal planning, costed shopping lists and a pantry for each person.

## People

**Member**:
A person on the invite list who can sign in. Every Member has exactly one role: Viewer, Editor or Admin.
_Avoid_: User, account

**Profile**:
A Member's display name and photo, shown on their Reviews and on Recipes they authored.
_Avoid_: Account, bio

## Recipes

**Recipe Book**:
The one shared collection of Recipes and their photos that every Member sees.
_Avoid_: Library, catalogue

**Recipe**:
A dish in the Recipe Book, made of ingredient lines each matched to a Product and an amount.

**Author**:
The Member who added a Recipe. An Author can edit their own Recipes; Editors can edit any Recipe.
_Avoid_: Owner, creator

**Main Photo**:
The one photo that represents a Recipe in the Recipe Book, chosen by Editors.
_Avoid_: Cover, thumbnail

**Review**:
One Member's 1 to 5 star rating of a Recipe, with an optional comment and photos. Each Member has at most one Review per Recipe.
_Avoid_: Rating, comment, feedback

**Product**:
A specific item sold at a store in a fixed pack size, with a price.
_Avoid_: Ingredient (an ingredient is a line in a Recipe; a Product is what you buy for it)

## Planning and shopping

**Plan**:
One Member's private week of Planned Meals.
_Avoid_: Meal plan, schedule

**Planned Meal**:
A Recipe placed in a day and slot of a Plan, at a chosen scale (×½, ×2 and so on).

**Cooked**:
The state of a Planned Meal once its Member says they made it. Only Cooked meals use up the Pantry.
_Avoid_: Done, eaten

**Shopping List**:
The Products a Plan needs for one week that the Pantry doesn't already cover, rounded up to whole packs, plus any extras the Member adds.
_Avoid_: Already have (the Pantry now decides what you already have)

**Got**:
A Shopping List item ticked off while shopping. Ticking Got puts the item into the Pantry.
_Avoid_: Bought, purchased

## Pantry

**Pantry**:
One Member's private stock of Products at home, with how much of each is left.
_Avoid_: Inventory, stock list, cupboard

**Pantry Item**:
A Product in a Pantry together with the amount remaining.

**Correction**:
A Member's hand change to a Pantry Item's amount, for food thrown out, used outside the Plan, or miscounted.
_Avoid_: Adjustment, edit
