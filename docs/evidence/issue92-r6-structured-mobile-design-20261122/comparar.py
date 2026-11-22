"""Only combines historical synthetic screenshots with R6 mock screenshots.
   Never reads or writes product, approved master source, or F8/R3 evidence."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

HERE=Path(__file__).parent
OUT=HERE/"comparaciones"
OUT.mkdir(exist_ok=True)
font=ImageFont.load_default()
for mode in ("viewport","full"):
    paths=[
        HERE/"referencias/sophilux-maestro-estilo-375.png",
        HERE/f"referencias/v4-r3-estructurado-375-{mode}.png",
        HERE/f"capturas/r6-375-{mode}.png"
    ]
    assert all(p.is_file() for p in paths),[str(p) for p in paths if not p.is_file()]
    images=[]
    for p in paths:
        img=Image.open(p).convert("RGB")
        if img.width != 375:
            img=img.resize((375,round(img.height*375/img.width)),Image.Resampling.LANCZOS)
        if mode=="viewport":
            img=img.crop((0,0,375,min(800,img.height)))
            if img.height<800:
                base=Image.new("RGB",(375,800),(255,253,250))
                base.paste(img,(0,0))
                img=base
        images.append(img)
    gutter=14
    upper=67
    h=max(x.height for x in images)
    canvas=Image.new("RGB",(3*375+4*gutter,upper+h+gutter),(247,245,242))
    d=ImageDraw.Draw(canvas)
    headings=["01 · SOPHILUX (estilo; otro estado)","02 · V4 R3 (32 columnas)","03 · R6 PROPUESTA (32 columnas)"]
    for idx,(im,head) in enumerate(zip(images,headings)):
        left=gutter+idx*(375+gutter)
        d.text((left+4,18),head,fill=(68,51,49),font=font)
        d.text((left+4,36),"Móvil 375 px · "+("primer viewport" if mode=="viewport" else "página completa"),fill=(112,91,85),font=font)
        canvas.paste(im,(left,upper))
    out=OUT/f"comparativa-r6-375-{mode}.png"
    canvas.save(out,optimize=True)
    print(out,len(images),canvas.size,out.stat().st_size)
