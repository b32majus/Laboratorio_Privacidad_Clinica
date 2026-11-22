"""REC-12 R6 visual witness: frozen R3 real -> approved R6 mock -> R6 real.
No edits to R3 screenshot, accepted master, runtime or source documents."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
HERE=Path(__file__).resolve().parent
REF=HERE/"referencias"
ACT=HERE/"actual"
OUT=HERE/"comparaciones"
OUT.mkdir(parents=True,exist_ok=True)
for mode in ("viewport","full"):
    imgs=[
      REF/f"v4-r3-estructurado-375-{mode}.png",
      REF/f"r6-375-{mode}.png",
      ACT/f"structured-375-{mode}.png",
    ]
    assert all(p.exists() for p in imgs),[str(p) for p in imgs if not p.exists()]
    shots=[]
    for f in imgs:
        im=Image.open(f).convert("RGB")
        if im.width!=375:
            im=im.resize((375,round(im.height*375/im.width)),Image.Resampling.LANCZOS)
        if mode=="viewport" and im.height != 800:
            im=im.crop((0,0,375,min(im.height,800)))
            if im.height<800:
                bg=Image.new("RGB",(375,800),"#fffdfa")
                bg.paste(im)
                im=bg
        shots.append(im)
    gap=14
    top=70
    h=max(im.height for im in shots)
    canvas=Image.new("RGB",(3*375+4*gap,top+h+gap),"#f7f5f2")
    draw=ImageDraw.Draw(canvas)
    labels=["01 · V4 R3 ANTERIOR","02 · MAQUETA R6 APROBADA","03 · V4 R6 REAL"]
    for i,(im,label) in enumerate(zip(shots,labels)):
        x=gap+i*(375+gap)
        draw.text((x+5,19),label,fill="#60423c",font=ImageFont.load_default())
        draw.text((x+5,37),"375 px | "+("primer viewport" if mode=="viewport" else "pagina completa"),fill="#83716a",font=ImageFont.load_default())
        canvas.paste(im,(x,top))
    file=OUT/f"comparativa-r6-react-375-{mode}.png"
    canvas.save(file,optimize=True)
    print("R6_COMPARISON",file,canvas.size,file.stat().st_size)
