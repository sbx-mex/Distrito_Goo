from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'photos'
OUT.mkdir(parents=True, exist_ok=True)
GREEN = '#006241'; DARK = '#173c31'; MINT = '#e8f3ee'; LIGHT = '#f7faf8'; GRAY = '#53665e'; ORANGE = '#c65d18'; WHITE = '#ffffff'
FONT_DIR = '/usr/share/fonts/truetype/dejavu'
def f(name, size):
    try: return ImageFont.truetype(f'{FONT_DIR}/{name}.ttf', size)
    except Exception: return ImageFont.load_default()
F_H1=f('DejaVuSans-Bold',64); F_H2=f('DejaVuSans-Bold',42); F_H3=f('DejaVuSans-Bold',30); F_BOLD=f('DejaVuSans-Bold',24); F_BODY=f('DejaVuSans',24); F_SMALL=f('DejaVuSans',21); F_XS=f('DejaVuSans',18); F_MONO=f('DejaVuSansMono-Bold',26)

def rr(d, xy, r, fill, outline=None, width=1): d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)
def tx(d, xy, s, font, fill=DARK, anchor=None, align='left'): d.text(xy, s, font=font, fill=fill, anchor=anchor, align=align)
def wrap(s, n): return '\n'.join(textwrap.wrap(str(s), width=n, break_long_words=False))
def save(img, base):
    png=OUT/f'{base}.png'; webp=OUT/f'{base}.webp'; thumb=OUT/f'{base}.thumb.webp'
    img.save(png, optimize=True)
    img.save(webp, quality=88, method=6)
    t=img.copy(); t.thumbnail((720,405), Image.Resampling.LANCZOS); t.save(thumb, quality=82, method=6)
    print(png, webp, thumb)

def badge(d, x, y, label):
    bb=d.textbbox((0,0), label, font=F_SMALL); w=bb[2]-bb[0]+42
    rr(d,(x,y,x+w,y+48),24,MINT)
    tx(d,(x+w/2,y+24),label,F_SMALL,GREEN,'mm')

def make_resumen():
    im=Image.new('RGB',(1920,1080),WHITE); d=ImageDraw.Draw(im)
    rr(d,(48,40,1872,202),38,GREEN)
    tx(d,(95,82),'ALINEACION PAGOS ESPECIALES',F_H1,WHITE)
    tx(d,(100,154),'Resumen operativo para solicitar incidencias correctamente',F_H2,'#dff3e8')
    badge(d,1515,82,'Siempre disponible')
    tx(d,(84,258),'Flujo de pago',F_H2,GREEN)
    steps=[('1','ADP','Envia layout\n4 dias habiles antes'),('2','HRBP + DM','Valida archivo\nlimpio por region'),('3','ADP','Consolida\nportafolios'),('4','Planner','Retira lineas\nfuera de regla'),('5','Nominas','Recibe archivo\nfinal para pago')]
    x0,y0,w,h,g=84,320,333,150,22
    for i,(n,t,desc) in enumerate(steps):
        x=x0+i*(w+g); rr(d,(x,y0,x+w,y0+h),24,LIGHT,'#cfe2d8',2)
        rr(d,(x+24,y0+28,x+78,y0+82),27,GREEN); tx(d,(x+51,y0+55),n,F_H3,WHITE,'mm')
        tx(d,(x+96,y0+28),t,F_H3,DARK); tx(d,(x+96,y0+68),desc,F_BODY,GRAY)
        if i<4: tx(d,(x+w+5,y0+61),'>',F_H2,GREEN)
    tx(d,(84,540),'Reglas que evitan rechazo',F_H2,GREEN)
    rules=[('Periodo correcto','Solo quincena inmediata anterior.'),('Registro exacto','Dias, horas o monto segun el DIP.'),('Comentario completo','Motivo, fechas, periodo y evidencia cuando aplique.'),('Validacion previa','HRBP/DM revisan antes de enviar a ADP.')]
    for i,(t,desc) in enumerate(rules):
        x=84+(i%2)*620; y=600+(i//2)*120; rr(d,(x,y,x+580,y+88),20,'#f2f8f5','#d4e5dc',2)
        tx(d,(x+28,y+17),t,F_H3,DARK); tx(d,(x+28,y+52),wrap(desc,46),F_SMALL,GRAY)
    tx(d,(1325,540),'DIPS de pago',F_H2,GREEN)
    dips=[('AYTR','Transporte','DIAS'),('DADL','Dia adicional','DIAS'),('DDES','Descanso lab.','DIAS'),('GRAE','Grat. extra','MONTO'),('GRAJ','Ajuste nomina','MONTO'),('HEXT','Horas extra','HORAS'),('DFES','Festivo','DIAS'),('PDOM','Prima dom.','DIAS'),('TRCU','Referidos','MONTO'),('PNOE','Pago exceso','MONTO')]
    for i,(code,name,reg) in enumerate(dips):
        x=1325+(i%2)*235; y=600+(i//2)*68; rr(d,(x,y,x+215,y+52),15,MINT if reg!='MONTO' else '#fff2e8','#cddfd6',1)
        tx(d,(x+15,y+13),code,F_MONO,GREEN); tx(d,(x+88,y+9),name,F_XS,DARK); tx(d,(x+88,y+30),reg,F_XS,ORANGE if reg=='MONTO' else GREEN)
    rr(d,(84,955,1836,1030),28,DARK)
    tx(d,(116,974),'Ver mas detalle: abrir PDF "Alineacion Pagos Especiales 2026" en Distrito Go.',F_H3,WHITE)
    tx(d,(1490,979),'Uso interno',F_BODY,'#dff3e8')
    return im

def make_eval():
    im=Image.new('RGB',(1920,1080),WHITE); d=ImageDraw.Draw(im)
    rr(d,(48,40,1872,190),38,GREEN)
    tx(d,(95,86),'EVALUACION RAPIDA - PAGOS ESPECIALES',F_H1,WHITE)
    tx(d,(100,150),'Checklist para operacion antes de enviar incidencias',F_H3,'#dff3e8')
    items=[('1. DIP correcto','Confirma que el concepto corresponde al caso real: transporte, dia adicional, descanso, ajuste, festivo, prima, referidos o recuperacion.'),('2. Periodo valido','Debe pertenecer a la quincena inmediata anterior; evita enviar incidencias antiguas.'),('3. Registro correcto','Usa dias, horas o monto segun el lineamiento del concepto.'),('4. Comentario usable','Escribe fechas, motivo, periodo y evidencia o ticket si aplica.'),('5. Validacion DM/HRBP','Enviar limpio y validado evita rechazos y reprocesos.')]
    for i,(t,desc) in enumerate(items):
        x,y=84,250+i*130; rr(d,(x,y,x+800,y+100),22,LIGHT,'#cfe2d8',2); rr(d,(x+28,y+28,x+78,y+78),25,GREEN)
        tx(d,(x+53,y+53),'✓',F_H3,WHITE,'mm'); tx(d,(x+105,y+20),t,F_H3,DARK); tx(d,(x+105,y+57),wrap(desc,70),F_SMALL,GRAY)
    tx(d,(980,255),'Ruta de decision',F_H2,GREEN)
    tree=[('¿Es pago especial?','No: no capturar en incidencias'),('¿Tiene fechas y periodo?','No: completar comentario'),('¿Cumple lineamiento?','No: corregir o retirar'),('¿Esta validado?','Si: enviar a ADP')]
    for i,(q,a) in enumerate(tree):
        y=315+i*116; rr(d,(980,y,1810,y+82),20,'#edf7f2' if i%2==0 else '#fff7ef','#cfe2d8',2)
        tx(d,(1012,y+16),q,F_H3,DARK); tx(d,(1012,y+50),a,F_BODY,ORANGE if a.startswith('No') else GREEN)
        if i<3: tx(d,(1395,y+89),'↓',F_H2,GREEN,'mm')
    rr(d,(980,820,1810,945),26,'#f2f8f5','#cfe2d8',2)
    tx(d,(1015,845),'Criterio final',F_H2,GREEN)
    tx(d,(1015,895),wrap('Si falta fecha, motivo, periodo, monto/hora/dia o evidencia, no esta listo para pago.',58),F_H3,DARK)
    tx(d,(84,1015),'Informacion confidencial - uso interno - consultar PDF completo en Ver mas.',F_BODY,GRAY)
    return im

if __name__=='__main__':
    save(make_resumen(),'alineacion-pagos-especiales-resumen')
    save(make_eval(),'alineacion-pagos-especiales-evaluacion')
