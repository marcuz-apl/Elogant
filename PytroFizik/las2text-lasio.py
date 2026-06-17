import lasio

# 1. Read the LAS file
las = lasio.read("./data/WA1.LAS", null_policy="none", engine="normal")

# 2. Convert the curve data to a Pandas DataFrame
df = las.df()

# 3. Export to a space-delimited text file (.txt)
df.to_csv("./data/WA1.txt", sep=" ", index=True)
